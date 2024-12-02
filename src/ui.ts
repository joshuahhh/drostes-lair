import {
  Flowchart,
  framePathForStep,
  runHelper,
  Scene,
  Step,
  TraceTree,
} from "./interpreter";
import { loadImg } from "./ui_util";
import { indexById, truthy } from "./util";
import { add, v } from "./vec2";

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

const myFlowchart: Flowchart = {
  id: "fc1",
  initialFrameId: "1",
  frames: indexById([
    { id: "1" },
    // we can place a vertical domino...
    {
      id: "one-domino-1",
      action: {
        type: "test-func",
        func: ({ value }) => {
          if (value.width < 1) {
            throw new Error("width must be at least 1");
          }
          return [
            {
              value: {
                ...value,
                dominoes: [
                  ...value.dominoes,
                  [
                    [0, 0],
                    [0, 1],
                  ],
                ],
              },
            },
          ];
        },
        failureFrameId: "base-case",
      },
    },
    // ...and recurse
    {
      id: "one-domino-2",
      action: {
        type: "call",
        flowchartId: "fc1",
        lens: {
          type: "domino-grid",
          dx: 1,
          dy: 0,
        },
      },
    },
    // alternatively, we can place two horizontal dominoes...
    {
      id: "two-dominoes-1",
      action: {
        type: "test-func",
        func: ({ value }) => {
          if (value.width < 2) {
            throw new Error("width must be at least 2");
          }
          return [
            {
              value: {
                ...value,
                dominoes: [
                  ...value.dominoes,
                  [
                    [0, 0],
                    [1, 0],
                  ],
                  [
                    [0, 1],
                    [1, 1],
                  ],
                ],
              },
            },
          ];
        },
      },
    },
    // ...and recurse
    {
      id: "two-dominoes-2",
      action: {
        type: "call",
        flowchartId: "fc1",
        lens: {
          type: "domino-grid",
          dx: 2,
          dy: 0,
        },
      },
    },
    // and here's where we go if things don't work out
    {
      id: "base-case",
    },
  ]),
  arrows: [
    { from: "1", to: "one-domino-1" },
    { from: "one-domino-1", to: "one-domino-2" },
    { from: "1", to: "two-dominoes-1" },
    { from: "two-dominoes-1", to: "two-dominoes-2" },
  ],
};
const initialValue = {
  width: 2,
  height: 2,
  dominoes: [],
};
const { traceTree, flowchart, initStepId } = runHelper(
  [myFlowchart],
  initialValue,
);

const nextSteps = (traceTree: TraceTree, step: Step) =>
  Object.values(traceTree.steps).filter(
    ({ prevStepId }) => prevStepId === step.id,
  );

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
      const size = 8;
      ctx.font = size + "px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.strokeStyle = "#2B2B29";
      ctx.lineWidth = 6;
      strokeMultiline(text, ...add(pos, [0, 1]), size);
      ctx.fillStyle = "#D9BE67";
      fillMultiline(text, ...pos, size);
    };
    const renderScene = (
      { value }: Scene,
      pos: [number, number], // TODO: rename: is this the top left corner?
      isOutlined: boolean = false,
    ) => {
      if (isOutlined) {
        ctx.beginPath();
        ctx.lineWidth = 10;
        ctx.strokeStyle = "green";
        ctx.rect(...pos, sceneW, sceneH);
        ctx.stroke();
      }
      renderParchmentBox(...pos, sceneW, sceneH);
      renderOutlinedText(JSON.stringify(value, null, 2), [
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
      // make the flame calmer (slow down time) after it flickered from frame 40 to 70
      if (t > 75 && Math.random() < 0.3) return t;
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
      // Weird BUG: part of trace disappears sometimes for a certain horizontal pan
      const scenePad = 20;
      const renderTrace = (
        stack: Step[],
        { stacks, stackFromStepId }: StepStacks,
        initX: number,
        myY: number,
        xFromStack: Map<Step[], number> = new Map(),
      ) => {
        const prevStacks = stack
          .map((step) =>
            step.prevStepId ? stackFromStepId[step.prevStepId] : false,
          )
          .filter(truthy);
        const prevStackXs = prevStacks.map((stack) => xFromStack.get(stack));
        if (!prevStackXs.every(truthy)) return 0;

        const myX = Math.max(initX, ...prevStackXs) + sceneW + scenePad;
        const myPos = [myX, myY] as [number, number];

        xFromStack.set(stack, myX);

        let i = 0;
        let j = 0;
        for (const step of stack) {
          ctx.save();
          if (i > 0) ctx.globalAlpha = 0.6;
          const isFinalStep = traceTree.finalStepIds.includes(step.id);
          renderScene(step.scene, add(myPos, v(i * 10)), isFinalStep);
          ctx.restore();

          for (const nextStep of nextSteps(traceTree, step)) {
            const v = renderTrace(
              stackFromStepId[nextStep.id],
              { stacks, stackFromStepId },
              initX,
              myY + j * (sceneH + scenePad),
              xFromStack,
            );
            renderOutlinedText(v + "", [
              myX + sceneW + scenePad,
              myY + j * (sceneH + scenePad),
            ]);
            j += v;
          }
          i++;
        }
        return Math.max(j, 1);
      };
      const s = getStepStacks(traceTree);
      renderTrace(s.stackFromStepId[initStepId], s, ...add(pan, v(100)));

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

// some logic stuff...

// a "step stack" is the set of steps shown at a single location in
// the diagram (which can be ID'd by a frame path)
type StepStacks = {
  // map from frame path to its stack (bijective)
  stacks: { [framePathId: string]: Step[] };
  // map from step id to its stack (surjective)
  stackFromStepId: { [stepId: string]: Step[] };
};

function getStepStacks(tree: TraceTree) {
  const stacks: { [framePathId: string]: Step[] } = {};
  const stackFromStepId: { [stepId: string]: Step[] } = {};

  for (const step of Object.values(tree.steps)) {
    const serializedFramePath = JSON.stringify(framePathForStep(step, tree));
    let stack = stacks[serializedFramePath];
    if (!stack) {
      stack = stacks[serializedFramePath] = [];
    }
    stack.push(step);
    stackFromStepId[step.id] = stack;
  }

  return { stacks, stackFromStepId };
}