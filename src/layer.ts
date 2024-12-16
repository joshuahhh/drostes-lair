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
  private commands: (((ctx: CanvasRenderingContext2D) => void) | LayerImpl)[] =
    [];

  private thisProxy: Layer;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private drawable: boolean,
    private spawnParent?: LayerImpl,
  ) {
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
          this.commands.push((ctx) => {
            // @ts-ignore
            ctx[prop](...args);
          });
        };
      },

      set: (_target, prop, value) => {
        // Capture property assignments
        this.commands.push((ctx) => {
          // @ts-ignore
          ctx[prop] = value;
        });
        return true;
      },
    });
  }

  private _draw(): void {
    for (const command of this.commands) {
      if (command instanceof LayerImpl) {
        command._draw();
      } else {
        command(this.ctx);
      }
    }
  }

  draw(): void {
    if (this.drawable) {
      this._draw();
      this.drawable = false;
    } else {
      throw new Error("Can't draw a non-root / already-drawn layer");
    }
  }

  spawnHere(): Layer {
    const lyr = LayerImpl.make(this.ctx, false);
    this.commands.push(lyr);
    return lyr;
  }

  // TODO: do we want spawnAtEnd()?

  spawnLater(): Layer {
    const lyr = LayerImpl.make(this.ctx, false, this);
    return lyr;
  }

  place() {
    if (this.spawnParent) {
      this.spawnParent.commands.push(this);
    } else {
      throw new Error("Can't place a root layer");
    }
  }

  do(f: (lyr: Layer) => void) {
    this.thisProxy.save();
    f(this.thisProxy);
    this.thisProxy.restore();
  }

  withContext(f: (ctx: CanvasRenderingContext2D) => void) {
    this.commands.push(f);
  }

  // To get stuff out of LayerImpl, we use static methods (which have
  // access to private fields)

  static make(...args: ConstructorParameters<typeof LayerImpl>): Layer {
    return new LayerImpl(...args).thisProxy;
  }

  static commandCount(lyr: LayerImpl): number {
    return lyr.commands
      .map((cmd) =>
        cmd instanceof LayerImpl ? LayerImpl.commandCount(cmd) : 1,
      )
      .reduce((a, b) => a + b, 0);
  }
}

export type Layer = CanvasRenderingContext2D & LayerImpl;

export function layer(lyr: CanvasRenderingContext2D): Layer {
  return LayerImpl.make(lyr, true);
}

export function getLayerCommandCount(lyr: Layer): number {
  return LayerImpl.commandCount(lyr);
}
