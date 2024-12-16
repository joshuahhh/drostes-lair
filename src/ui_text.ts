import { Layer } from "./layer";
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

export const drawOutlinedText = (
  lyr: Layer,
  text: string,
  pos: Vec2,
  opts: {
    textAlign?: CanvasTextAlign;
    textBaseline?: CanvasTextBaseline;
    size?: number;
    family?: string;
    color?: string;
  } = {},
) => {
  lyr.withContext((ctx) => {
    const {
      textAlign = "center",
      textBaseline = "middle",
      size = 12,
      family = "serif",
      color = "#D9BE67",
    } = opts;

    ctx.font = `${size}px ${family}`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;

    if ((window as any).isBoring) {
      const width = ctx.measureText(text).width;
      ctx.fillStyle = color;
      ctx.fillRect(
        pos[0] +
          (textAlign === "center"
            ? -width / 2
            : textAlign === "right"
              ? -width
              : 0),
        pos[1] + (textBaseline === "middle" ? -size / 2 : 0),
        width,
        size,
      );

      ctx.fillStyle = "#2B2B29";
      fillMultiline(ctx, text, ...add(pos, [0, 1]), size);
    } else {
      ctx.strokeStyle = "#2B2B29";
      ctx.lineWidth = 6;
      strokeMultiline(ctx, text, ...add(pos, [0, 1]), size);
      ctx.fillStyle = color;
      fillMultiline(ctx, text, ...pos, size);
    }
  });
};
