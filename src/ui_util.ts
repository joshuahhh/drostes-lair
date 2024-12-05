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
