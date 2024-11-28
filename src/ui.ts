import { Scene, Step, TraceTree } from ".";
import { loadImg, runHelper } from "./ui_util";
import { indexById } from "./util";
import { add } from "./vec2";

const c = document.getElementById("c") as HTMLCanvasElement;
const ctx = c.getContext("2d")!;

const audioContext = new AudioContext();

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
            func: ({ value: x }) => [
              {
                value: x + 1,
              },
            ],
          },
        },
        {
          id: "3",
          action: {
            type: "test-func",
            func: ({ value: x }) => [
              {
                value: x + 2,
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
                value: x + 3,
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
                value: x / 2,
              },
            ],
          },
        },
      ]),
      arrows: [
        { from: "1", to: "2" },
        { from: "1", to: "3" },
        { from: "1", to: "4" },
        { from: "4", to: "5" },
      ],
    },
  ],
  3,
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
      ctx.drawImage(
        img,
        Math.random() * 2,
        Math.random() * 2,
        w,
        h,
        x,
        y,
        w,
        h,
      );
      ctx.restore();
    };
    const sceneW = 100;
    const sceneH = 100;
    const renderScene = ({ value }: Scene, pos: [number, number]) => {
      renderParchmentBox(...pos, sceneW, sceneH);

      ctx.font = "32px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.strokeStyle = "#2B2B29";
      ctx.lineWidth = 6;
      ctx.strokeText(
        JSON.stringify(value, undefined, 1),
        pos[0] + sceneW / 2,
        pos[1] + sceneH / 2 + 1,
      );
      ctx.fillStyle = "#D9BE67";
      ctx.fillText(
        JSON.stringify(value, undefined, 1),
        pos[0] + sceneW / 2,
        pos[1] + sceneH / 2,
      );
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

    requestAnimationFrame(drawLoop);
    let t = 0;
    function drawLoop() {
      requestAnimationFrame(drawLoop);
      // draw background
      const pattern = ctx.createPattern(img2, "repeat")!;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, c.width, c.height);

      // render trace
      // TODO: render the whole tree and not just the first couple steps
      const initStepPos = [100, 100] as [number, number];
      renderScene(initStep.scene, add(initStepPos, pan));
      const scenePad = 20;
      let i = 0;
      for (const nextStep of nextSteps(traceTree, initStep)) {
        renderScene(
          nextStep.scene,
          add(
            add(initStepPos, [sceneW + scenePad, (sceneW + scenePad) * i]),
            pan,
          ),
        );
        i++;
      }

      // render candle
      renderSpriteSheet(
        imgCandleSheet,
        Math.floor(t),
        127,
        10,
        [100, 100],
        [550, 560],
        [300, 300],
      );
      // candle flicker dimming
      if ([45, 48, 49, 50, 51, 52, 53].some((i) => i === t % 127)) {
        ctx.fillStyle = "rgba(0,0,0,0.03)";
        ctx.fillRect(0, 0, c.width, c.height);
      }

      t++;
    }
  },
);
