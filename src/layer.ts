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
  private _above: Layer | null = null;
  private _below: Layer | null = null;

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
    this._below?.replay();
    for (const command of this.commands) {
      command();
    }
    this._above?.replay();
  }

  get above(): Layer {
    if (!this._above) {
      this._above = layer(this.ctx);
    }
    return this._above;
  }

  get below(): Layer {
    if (!this._below) {
      this._below = layer(this.ctx);
    }
    return this._below;
  }

  static make(ctx: CanvasRenderingContext2D): Layer {
    return new LayerImpl(ctx).thisProxy;
  }

  /** For debugging */
  static getCommands(ctx: Layer) {
    return ctx.commands;
  }

  static countCommands(ctx: Layer): number {
    return (
      (ctx._below ? LayerImpl.countCommands(ctx._below) : 0) +
      ctx.commands.length +
      (ctx._above ? LayerImpl.countCommands(ctx._above) : 0)
    );
  }
}

export type Layer = CanvasRenderingContext2D & LayerImpl;

export function layer(ctx: CanvasRenderingContext2D): Layer {
  return LayerImpl.make(ctx);
}

export function getLayerCommandCount(ctx: Layer): number {
  return LayerImpl.countCommands(ctx);
}
