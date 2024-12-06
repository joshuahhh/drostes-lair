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

export const inXYWH = (tx: number, ty: number, [x, y, w, h]: XYWH) => {
  return x <= tx && tx <= x + w && y <= ty && ty <= y + h;
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

type CanvasCommand =
  | {
      objectProxy: object;
      type: "call";
      prop: string | symbol;
      args: any[];
      resultProxy: object;
    }
  | {
      objectProxy: object;
      type: "set";
      prop: string | symbol;
      value: any;
    };

class FancyCanvasContextImpl {
  private commands: CanvasCommand[] = [];
  private _above: FancyCanvasContext | null = null;
  private _below: FancyCanvasContext | null = null;

  private proxies: WeakSet<any> = new WeakSet();
  private thisProxy: FancyCanvasContext;

  constructor() {
    // make typescript happy; you're supposed to use static make()
    this.thisProxy = undefined as any;
  }

  private makeProxy<T>(target: any = {}): T {
    const handler: ProxyHandler<any> = {
      get: (target, prop) => {
        if (prop in target) {
          return (target as any)[prop];
        }

        // Assume the property is a method, and return a function to capture calls
        return (...args: any[]) => {
          const resultProxy = this.makeProxy<any>({});
          this.commands.push({
            type: "call",
            objectProxy: proxy,
            prop,
            args,
            resultProxy,
          });
          return resultProxy;
        };
      },

      set: (_target, prop, value) => {
        // Capture property assignments
        this.commands.push({ type: "set", objectProxy: proxy, prop, value });
        return true;
      },
    };

    const proxy = new Proxy(target, handler);
    this.proxies.add(proxy);
    return proxy;
  }

  // Replay all captured commands on the real CanvasRenderingContext2D
  replay(ctx: CanvasRenderingContext2D): void {
    this._below?.replay(ctx);
    const runtimeValues: Map<Object, any> = new Map([[this.thisProxy, ctx]]);
    const resolveValue = (value: any): any => {
      if (this.proxies.has(value)) {
        if (runtimeValues.has(value)) {
          return runtimeValues.get(value);
        } else {
          throw new Error(
            "FancyProxy used before being assigned a value... woah",
          );
        }
      } else {
        return value;
      }
    };
    for (const command of this.commands) {
      try {
        const resolvedObject = resolveValue(command.objectProxy);
        if (command.type === "call") {
          const resolvedArgs = command.args.map(resolveValue);
          const result = resolvedObject[command.prop](...resolvedArgs);
          runtimeValues.set(command.resultProxy, result);
        } else if (command.type === "set") {
          const resolvedValue = resolveValue(command.value);
          resolvedObject[command.prop] = resolvedValue;
        }
      } catch (e) {
        console.error("Error replaying command", command);
        console.error("Resolved object", resolveValue(command.objectProxy));
        if (command.type === "call") {
          console.error("Resolved args", command.args.map(resolveValue));
        } else if (command.type === "set") {
          console.error("Resolved value", resolveValue(command.value));
        }
        throw e;
      }
    }
    this._above?.replay(ctx);
  }

  clearQueue(): void {
    this.commands = [];
  }

  get above(): FancyCanvasContext {
    if (!this._above) {
      this._above = fancyCanvasContext();
    }
    return this._above;
  }

  get below(): FancyCanvasContext {
    if (!this._below) {
      this._below = fancyCanvasContext();
    }
    return this._below;
  }

  static make(): FancyCanvasContext {
    const target = new FancyCanvasContextImpl();
    const proxy = target.makeProxy<FancyCanvasContext>(target);
    target.thisProxy = proxy;
    return proxy;
  }

  /** For debugging */
  static getCommands(ctx: FancyCanvasContext) {
    return ctx.commands;
  }
}

export type FancyCanvasContext = CanvasRenderingContext2D &
  FancyCanvasContextImpl;

export function fancyCanvasContext(): FancyCanvasContext {
  return FancyCanvasContextImpl.make();
}

export function getFancyCanvasContextCommands(
  ctx: FancyCanvasContext,
): CanvasCommand[] {
  return FancyCanvasContextImpl.getCommands(ctx);
}
