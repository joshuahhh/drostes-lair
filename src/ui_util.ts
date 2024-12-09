import { Vec2 } from "./vec2";

export const loadImg = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    // Only use the image after it's loaded
    img.onload = () => resolve(img);
    img.onerror = reject;
  });

export const loadAudio = async (
  url: string,
): Promise<AudioBufferSourceNode> => {
  const context = new AudioContext();
  const source = context.createBufferSource();
  const audioBuffer = await fetch(url)
    .then((res) => res.arrayBuffer())
    .then((ArrayBuffer) => context.decodeAudioData(ArrayBuffer));

  source.buffer = audioBuffer;
  source.connect(context.destination);

  return source;
};

export const fillRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
};

export const fillRectGradient = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color1: string,
  color2: string,
  dir: "H" | "V",
) => {
  const gradient = ctx.createLinearGradient(
    x,
    y,
    dir === "H" ? x + width : x,
    dir === "H" ? y : y + height,
  );
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
};

export type XYWH = readonly [number, number, number, number];

export const XYWH = (x: number, y: number, w: number, h: number): XYWH => {
  if (w < 0) {
    x -= w;
    w = -w;
  }
  if (h < 0) {
    y -= h;
    h = -h;
  }
  return [x, y, w, h];
};

export const inXYWH = (tx: number, ty: number, [x, y, w, h]: XYWH) => {
  return x <= tx && tx <= x + w && y <= ty && ty <= y + h;
};

export const tl = (xywh: XYWH): Vec2 => [xywh[0], xywh[1]];
export const tr = (xywh: XYWH): Vec2 => [xywh[0] + xywh[2], xywh[1]];
export const bl = (xywh: XYWH): Vec2 => [xywh[0], xywh[1] + xywh[3]];
export const br = (xywh: XYWH): Vec2 => [xywh[0] + xywh[2], xywh[1] + xywh[3]];
export const tm = (xywh: XYWH): Vec2 => [xywh[0] + xywh[2] / 2, xywh[1]];
export const bm = (xywh: XYWH): Vec2 => [
  xywh[0] + xywh[2] / 2,
  xywh[1] + xywh[3],
];
export const ml = (xywh: XYWH): Vec2 => [xywh[0], xywh[1] + xywh[3] / 2];
export const mr = (xywh: XYWH): Vec2 => [
  xywh[0] + xywh[2],
  xywh[1] + xywh[3] / 2,
];
export const mm = (xywh: XYWH): Vec2 => [
  xywh[0] + xywh[2] / 2,
  xywh[1] + xywh[3] / 2,
];

export const expand = (xywh: XYWH, dx: number, dy?: number): XYWH => {
  if (dy === undefined) dy = dx;
  return [xywh[0] - dx, xywh[1] - dy, xywh[2] + 2 * dx, xywh[3] + 2 * dy];
};

export function saveFile(contents: Blob, fileName: string) {
  let dummyLink = document.createElement("a");
  dummyLink.href = URL.createObjectURL(contents);
  dummyLink.download = fileName;
  dummyLink.click();
  URL.revokeObjectURL(dummyLink.href);
}

// can make Blob from contents with
//   new Blob([contents], {type})
// type is something funky like "application/json;charset=utf-8"

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
 * cannot be used with FancyCanvasContext at all.
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

class FancyCanvasContextImpl {
  private commands: (() => void)[] = [];
  private _above: FancyCanvasContext | null = null;
  private _below: FancyCanvasContext | null = null;

  private thisProxy: FancyCanvasContext;

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
          throw new Error(
            `FancyCanvasContext doesn't support ${String(prop)}; sorry.`,
          );
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

  get above(): FancyCanvasContext {
    if (!this._above) {
      this._above = fancyCanvasContext(this.ctx);
    }
    return this._above;
  }

  get below(): FancyCanvasContext {
    if (!this._below) {
      this._below = fancyCanvasContext(this.ctx);
    }
    return this._below;
  }

  static make(ctx: CanvasRenderingContext2D): FancyCanvasContext {
    return new FancyCanvasContextImpl(ctx).thisProxy;
  }

  /** For debugging */
  static getCommands(ctx: FancyCanvasContext) {
    return ctx.commands;
  }

  static countCommands(ctx: FancyCanvasContext): number {
    return (
      (ctx._below ? FancyCanvasContextImpl.countCommands(ctx._below) : 0) +
      ctx.commands.length +
      (ctx._above ? FancyCanvasContextImpl.countCommands(ctx._above) : 0)
    );
  }
}

export type FancyCanvasContext = CanvasRenderingContext2D &
  FancyCanvasContextImpl;

export function fancyCanvasContext(
  ctx: CanvasRenderingContext2D,
): FancyCanvasContext {
  return FancyCanvasContextImpl.make(ctx);
}

export function getFancyCanvasContextCommandCount(
  ctx: FancyCanvasContext,
): number {
  return FancyCanvasContextImpl.countCommands(ctx);
}
