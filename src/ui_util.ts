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
