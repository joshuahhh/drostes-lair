import { add } from "./vec2";

export const makeOutlinedTextRenderer = (ctx: CanvasRenderingContext2D) => {
  const strokeMultiline = (
    txt: string,
    x: number,
    y: number,
    lineheight: number,
  ) => {
    let lines = txt.split("\n");

    for (let i = 0; i < lines.length; i++)
      ctx.strokeText(lines[i], x, y + i * lineheight);
  };
  const fillMultiline = (
    txt: string,
    x: number,
    y: number,
    lineheight: number,
  ) => {
    let lines = txt.split("\n");

    for (let i = 0; i < lines.length; i++)
      ctx.fillText(lines[i], x, y + i * lineheight);
  };

  const renderOutlinedText = (
    text: string,
    pos: [number, number],
    opts: {
      textAlign?: CanvasTextAlign;
      textBaseline?: CanvasTextBaseline;
      size?: number;
    } = {},
  ) => {
    const { textAlign = "center", textBaseline = "middle", size = 12 } = opts;

    ctx.font = size + "px serif";
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;

    ctx.strokeStyle = "#2B2B29";
    ctx.lineWidth = 6;
    strokeMultiline(text, ...add(pos, [0, 1]), size);
    ctx.fillStyle = "#D9BE67";
    fillMultiline(text, ...pos, size);
  };

  return renderOutlinedText;
};
