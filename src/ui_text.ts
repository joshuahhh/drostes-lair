import { add, Vec2 } from "./vec2";

export const strokeMultiline = (
  ctx: CanvasRenderingContext2D,
  txt: string,
  x: number,
  y: number,
  lineheight: number,
) => {
  let lines = txt.split("\n");

  for (let i = 0; i < lines.length; i++)
    ctx.strokeText(lines[i], x, y + i * lineheight);
};
export const fillMultiline = (
  ctx: CanvasRenderingContext2D,
  txt: string,
  x: number,
  y: number,
  lineheight: number,
) => {
  let lines = txt.split("\n");

  for (let i = 0; i < lines.length; i++)
    ctx.fillText(lines[i], x, y + i * lineheight);
};

export const renderOutlinedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  pos: Vec2,
  opts: {
    textAlign?: CanvasTextAlign;
    textBaseline?: CanvasTextBaseline;
    size?: number;
  } = {},
) => {
  const { textAlign = "center", textBaseline = "middle", size = 12 } = opts;

  ctx.font = size + "px monospace";
  ctx.textAlign = textAlign;
  ctx.textBaseline = textBaseline;

  ctx.strokeStyle = "#2B2B29";
  ctx.lineWidth = 6;
  strokeMultiline(ctx, text, ...add(pos, [0, 1]), size);
  ctx.fillStyle = "#D9BE67";
  fillMultiline(ctx, text, ...pos, size);
};
