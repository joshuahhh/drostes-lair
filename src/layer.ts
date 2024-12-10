/**
 * Properties that return (or directly are) values that don't depend
 * on context state. These can safely be proxied immediately to the
 * underlying context.
 */
const CTX_DIRECT_PROPERTIES: (keyof CanvasRenderingContext2D)[] = [
  "canvas",
  "createConicGradient",
  "createImageData",
  "createLinearGradient",
  "createPattern",
  "createRadialGradient",
  "getContextAttributes",
];

/**
 * Properties that return values dependent on context state. These
 * cannot be used with Layer at all.
 */
const CTX_UNSAFE_PROPERTIES: (keyof CanvasRenderingContext2D)[] = [
  "getImageData",
  "getLineDash",
  "getTransform",
  "isContextLost",
  "isPointInPath",
  "isPointInStroke",
  "measureText",
];

const includes = <T>(arr: T[], item: any): item is T => arr.includes(item);

class LayerImpl {
  private commands: (() => void)[] = [];
  private layersBelow: Layer[] = []; // push onto this one, so later-added layers are above earlier layers
  private layersAbove: Layer[] = []; // unshift onto this one, so later-added layers are below earlier layers

  private thisProxy: Layer;

  constructor(private ctx: CanvasRenderingContext2D) {
    this.thisProxy = new Proxy<any>(this, {
      get: (target, prop) => {
        if (prop in target) {
          return (target as any)[prop];
        }

        if (includes(CTX_DIRECT_PROPERTIES, prop)) {
          const value = this.ctx[prop];
          return typeof value === "function" ? value.bind(this.ctx) : value;
        }

        if (includes(CTX_UNSAFE_PROPERTIES, prop)) {
          throw new Error(`Layer doesn't support ${String(prop)}; sorry.`);
        }

        // Assume the property is a method, and return a function to capture calls
        return (...args: any[]) => {
          this.commands.push(() => {
            // @ts-ignore
            this.ctx[prop](...args);
          });
        };
      },

      set: (_target, prop, value) => {
        // Capture property assignments
        this.commands.push(() => {
          // @ts-ignore
          this.ctx[prop] = value;
        });
        return true;
      },
    });
  }

  // Replay all captured commands on the real CanvasRenderingContext2D
  replay(): void {
    this.layersBelow.forEach((layer) => layer.replay());
    for (const command of this.commands) {
      command();
    }
    this.layersAbove.forEach((layer) => layer.replay());
  }

  below(): Layer {
    const lyr = layer(this.ctx);
    this.layersBelow.push(lyr);
    return lyr;
  }

  above(): Layer {
    const lyr = layer(this.ctx);
    this.layersAbove.unshift(lyr);
    return lyr;
  }

  // To get stuff out of LayerImpl, we use static methods (which have
  // access to private fields)

  static make(lyr: CanvasRenderingContext2D): Layer {
    return new LayerImpl(lyr).thisProxy;
  }

  static commandCount(lyr: Layer): number {
    return (
      lyr.layersBelow.map(LayerImpl.commandCount).reduce((a, b) => a + b, 0) +
      lyr.commands.length +
      lyr.layersAbove.map(LayerImpl.commandCount).reduce((a, b) => a + b, 0)
    );
  }
}

export type Layer = CanvasRenderingContext2D & LayerImpl;

export function layer(lyr: CanvasRenderingContext2D): Layer {
  return LayerImpl.make(lyr);
}

export function getLayerCommandCount(lyr: Layer): number {
  return LayerImpl.commandCount(lyr);
}
