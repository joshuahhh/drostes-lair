import { framePathForStep, Scene, Step, TraceTree } from ".";
import { loadImg, runHelper } from "./ui_util";
import { indexById } from "./util";
import { add } from "./vec2";

const c = document.getElementById("c") as HTMLCanvasElement;
const ctx = c.getContext("2d")!;

const loadAudio = async (url: string): Promise<AudioBufferSourceNode> => {
  const context = new AudioContext();
  const source = context.createBufferSource();
  const audioBuffer = await fetch(url)
    .then((res) => res.arrayBuffer())
    .then((ArrayBuffer) => context.decodeAudioData(ArrayBuffer));

  source.buffer = audioBuffer;
  source.connect(context.destination);

  return source;
};

const { traceTree, flowchart, initStep } = runHelper(
  [
    {
      id: "fc1",
      initialFrameId: "1",
      frames: indexById([
        { id: "1" },
        {
          id: "2",
          action: {
            type: "test-func",
            func: ({ value: [x, y] }) => [
              {
                value: x + y,
              },
            ],
          },
        },
        {
          id: "3",
          action: {
            type: "test-func",
            func: ({ value: [x, y] }) => [
              {
                value: x * y,
              },
            ],
          },
        },
        {
          id: "4",
          action: {
            type: "test-func",
            func: ({ value: x }) => [
              {
                value: x + 1,
              },
            ],
          },
        },
        {
          id: "5",
          action: {
            type: "test-func",
            func: ({ value: x }) => [
              {
                value: x + 1,
              },
            ],
          },
        },
      ]),
      arrows: [
        { from: "1", to: "2" },
        { from: "1", to: "3" },
        { from: "2", to: "4" },
        { from: "3", to: "4" },
        { from: "4", to: "5" },
      ],
    },
  ],
  [3, 4],
);

const nextSteps = (traceTree: TraceTree, step: Step) =>
  Object.values(traceTree.steps).filter(
    ({ prevStepId }) => prevStepId === step.id,
  );

console.log(traceTree, flowchart);

Promise.all([
  loadImg("./assets/parchment.png"),
  loadImg("./assets/asfault.jpg"),
  loadImg("./assets/candle_sheet.png"),
  loadImg("./assets/glove3.png"),
  loadImg("./assets/glove2.png"),
  loadAudio("./assets/vocal.wav"),
  loadAudio("./assets/ambient.wav"),
]).then(
  ([
    img,
    img2,
    imgCandleSheet,
    imgGlovePoint,
    imgGloveGrab,
    audVocal,
    audAmbient,
  ]) => {
    // start ambient audio
    audAmbient.loop = true;
    audAmbient.start();

    let pan = [0, 0] as [number, number];

    // set up cursor stuff
    c.style.cursor = `url('./assets/glove3.png'), pointer`;
    c.addEventListener("mousedown", (e) => {
      c.style.cursor = `url('./assets/glove2.png'), pointer`;
      if (e.offsetX > 550 && e.offsetY > 550) audVocal.start();
    });
    c.addEventListener("mouseup", (e) => {
      c.style.cursor = `url('./assets/glove3.png'), pointer`;
    });

    const renderParchmentBox = (x: number, y: number, w: number, h: number) => {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,1)";
      ctx.shadowOffsetY = 4;
      ctx.shadowBlur = 15;
      ctx.drawImage(img, Math.random(), Math.random(), w, h, x, y, w, h);
      ctx.restore();
    };
    const sceneW = 100;
    const sceneH = 100;
    const renderOutlinedText = (text: string, pos: [number, number]) => {
      ctx.font = "32px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.strokeStyle = "#2B2B29";
      ctx.lineWidth = 6;
      ctx.strokeText(text, ...add(pos, [0, 1]));
      ctx.fillStyle = "#D9BE67";
      ctx.fillText(text, ...pos);
    };
    const renderScene = ({ value }: Scene, pos: [number, number]) => {
      renderParchmentBox(...pos, sceneW, sceneH);
      renderOutlinedText(JSON.stringify(value), [
        pos[0] + sceneW / 2,
        pos[1] + sceneH / 2,
      ]);
    };

    const renderSpriteSheet = (
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

    // panning
    c.addEventListener("mousemove", (e) => {
      if (e.shiftKey) {
        pan[0] += e.movementX;
        pan[1] += e.movementY;
        c.style.cursor = `url('./assets/glove1.png'), pointer`;
      } else {
        c.style.cursor = `url('./assets/glove3.png'), pointer`;
      }
    });

    // hand-tuned candle flicker frame machine
    const incCandleTime = (t: number) => {
      if (t > 127) return 0;
      // make the flame calmer (slow down time) after it flickered in frames 40 to 70
      if (t > 75 && Math.random() < 0.6) return t;
      // chances to not flicker, returning to previous points in the flame to look natural
      if (t === 30 && Math.random() < 0.3) return 80;
      if (t === 110 && Math.random() < 0.6) return 80;
      if (t === 127 && Math.random() < 0.6) return 71;
      return t + 1;
    };

    requestAnimationFrame(drawLoop);
    let t = 0;
    function drawLoop() {
      requestAnimationFrame(drawLoop);
      // draw background
      const pattern = ctx.createPattern(img2, "repeat")!;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, c.width, c.height);

      ctx.save();
      ctx.rotate(Math.random() / 500);
      ctx.globalAlpha = 0.12 + Math.random() / 40;
      renderOutlinedText(
        `I've asked the device to do a terrible thing...`,
        [400, 30],
      );
      renderOutlinedText(`Oh God, what have I computed?`, [590, 230]);
      renderOutlinedText(
        `Neither God nor Computer can save me now`,
        [300, 770],
      );
      ctx.restore();

      // render trace
      const scenePad = 20;
      const framePathToPos: { [key: string]: [number, number] } = {};
      const renderTrace = (step: Step, pos: [number, number]) => {
        const serializedFramePath = JSON.stringify(
          framePathForStep(step, traceTree),
        );
        const fpp = framePathToPos[serializedFramePath];
        if (fpp) {
          pos = add([5, 70], fpp);
        } else {
          framePathToPos[serializedFramePath] = pos;
        }
        renderScene(step.scene, pos);

        let i = 0;
        for (const nextStep of nextSteps(traceTree, step)) {
          renderTrace(
            nextStep,
            add(pos, [sceneW + scenePad, (sceneW + scenePad) * i]),
          );
          i++;
        }
      };
      renderTrace(initStep, add(pan, [100, 100]));

      // render candle
      renderSpriteSheet(
        imgCandleSheet,
        t,
        127,
        10,
        [100, 100],
        [550, 560],
        [300, 300],
      );
      //render candle glow
      const radialFlickerAmt = Math.random() * 12;
      const radialCenter = [700, 650] as [number, number];
      const gradient = ctx.createRadialGradient(
        ...radialCenter,
        30 - radialFlickerAmt,
        ...radialCenter,
        800 - radialFlickerAmt,
      );
      gradient.addColorStop(0, "rgba(255, 181, 174,0.2)");
      gradient.addColorStop(0.1, "rgba(235, 120, 54,0.1)");
      gradient.addColorStop(0.5, "rgba(255, 217, 66, 0)");
      gradient.addColorStop(0.5, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, c.width, c.height);
      // candle flicker dimming
      const dimFrames = [45, 48, 49, 50, 51, 52, 53];
      if (dimFrames.some((i) => i === t % 127)) {
        ctx.fillStyle = "rgba(0,0,0,0.03)";
        ctx.fillRect(0, 0, c.width, c.height);
      }

      t = incCandleTime(t);
    }
  },
);
