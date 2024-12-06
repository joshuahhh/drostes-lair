import {
  fancyCanvasContext,
  fillRectGradient,
  getFancyCanvasContextCommands,
} from "./ui_util";

const c = document.getElementById("c") as HTMLCanvasElement;

const ctxReal = c.getContext("2d") as CanvasRenderingContext2D;
const ctx = fancyCanvasContext();

ctx.fillStyle = "#8B4513";
ctx.fillRect(0, 0, 100, 100);

console.log(getFancyCanvasContextCommands(ctx));

fillRectGradient(ctx, 0, 0, 100, 100, "#FF0000", "#00FF00", "H");

console.log(getFancyCanvasContextCommands(ctx));

ctx.replay(ctxReal);
