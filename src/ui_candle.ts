import { renderOutlinedText } from "./ui_text";

// hand-tuned candle flicker frame machine
const incCandleTime = (t: number) => {
  if (t > 127) return 0;
  // make the flame calmer (slow down time) after it flickered from frame 40 to 70
  if (t > 75 && Math.random() < 0.3) return t;
  // chances to not flicker, returning to previous points in the flame to look natural
  if (t === 30 && Math.random() < 0.3) return 80;
  if (t === 110 && Math.random() < 0.6) return 80;
  if (t === 127 && Math.random() < 0.6) return 71;
  return t + 1;
};

export const renderSpriteSheet = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  frame: number,
  frameCount: number,
  columns: number,
  frameSize: [number, number],
  pos: [number, number],
  size: [number, number],
) => {
  const tt = frame % frameCount;
  const x = tt % columns;
  const y = Math.floor(tt / columns);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(
    img,
    x * frameSize[0],
    y * frameSize[1],
    ...frameSize,
    ...pos,
    ...size,
  );
  ctx.restore();
};

export const makeCandleRenderer = (
  ctx: CanvasRenderingContext2D,
  imgCandleSheet: HTMLImageElement,
) => {
  let t = 0;

  const render = () => {
    // render candle
    renderSpriteSheet(
      ctx,
      imgCandleSheet,
      t,
      127,
      10,
      [100, 100],
      [ctx.canvas.width - 250, ctx.canvas.height - 240],
      [300, 300],
    );
    //render candle glow

    // render spooky text
    // TODO: it's gotta be attached to something, right?
    if (false) {
      ctx.save();
      ctx.rotate(Math.random() / 500);
      ctx.globalAlpha = 0.12 + Math.random() / 40;
      renderOutlinedText(
        ctx,
        `I've asked the device to do a terrible thing...`,
        [400, 30],
      );
      renderOutlinedText(ctx, `Oh God, what have I computed?`, [590, 230]);
      renderOutlinedText(
        ctx,
        `Neither God nor Computer can save me now`,
        [300, 770],
      );
      ctx.restore();
    }

    // TODO: PERF this takes 10ms?
    const radialFlickerAmt = Math.random() * 12;
    const radialCenter = [ctx.canvas.width - 100, ctx.canvas.height - 150] as [
      number,
      number,
    ];
    const gradient = ctx.createRadialGradient(
      ...radialCenter,
      30 - radialFlickerAmt,
      ...radialCenter,
      ctx.canvas.width - radialFlickerAmt,
    );
    gradient.addColorStop(0, "rgba(255, 181, 174,0.2)");
    gradient.addColorStop(0.1, "rgba(235, 120, 54,0.1)");
    gradient.addColorStop(0.5, "rgba(255, 217, 66, 0)");
    gradient.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // candle flicker dimming
    const dimFrames = [45, 48, 49, 50, 51, 52, 53];
    if (dimFrames.some((i) => i === t % 127)) {
      ctx.fillStyle = "rgba(0,0,0,0.03)";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    t = incCandleTime(t);
  };

  return render;
};
