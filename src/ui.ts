import { dominoFlowchart } from "./dominoes.ex";
import {
  Action,
  Flowchart,
  framePathForStep,
  runHelper,
  Step,
  topLevelValueForStep,
  TraceTree,
} from "./interpreter";
import { loadImg } from "./ui_util";
import { truthy } from "./util";
import { add, v } from "./vec2";

const c = document.getElementById("c") as HTMLCanvasElement;
const cContainer = document.getElementById("c-container") as HTMLDivElement;
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;
    c.width = width - 56;
    c.height = height - 56;
  }
});
resizeObserver.observe(cContainer);
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

const myFlowchart: Flowchart = dominoFlowchart;
const initialValue = {
  width: 4,
  height: 2,
  dominoes: [],
};
const { traceTree, flowchart, initStepId, defs } = runHelper(
  [myFlowchart],
  initialValue,
);
console.log(traceTree);

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
    let shiftHeld = false;
    window.addEventListener("keydown", (e) => {
      if (e.key === "Shift") {
        shiftHeld = true;
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === "Shift") {
        shiftHeld = false;
      }
    });
    let mouseDown = false;
    c.addEventListener("mousedown", (e) => {
      mouseDown = true;
      if (e.offsetX > 550 && e.offsetY > 550) audVocal.start();
    });
    c.addEventListener("mouseup", () => {
      mouseDown = false;
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
    const renderOutlinedText = (
      text: string,
      pos: [number, number],
      textAlign: CanvasTextAlign = "center",
    ) => {
      const size = 12;
      ctx.font = size + "px serif";
      ctx.textAlign = textAlign;
      ctx.textBaseline = "middle";

      ctx.strokeStyle = "#2B2B29";
      ctx.lineWidth = 6;
      strokeMultiline(text, ...add(pos, [0, 1]), size);
      ctx.fillStyle = "#D9BE67";
      fillMultiline(text, ...pos, size);
    };
    const renderScene = (
      step: Step,
      pos: [number, number], // TODO: rename: is this the top left corner?
    ) => {
      const isOutlined = traceTree.finalStepIds.includes(step.id);
      if (isOutlined) {
        ctx.beginPath();
        ctx.lineWidth = 10;
        ctx.strokeStyle = "purple";
        ctx.rect(...pos, sceneW, sceneH);
        ctx.stroke();
      }
      renderParchmentBox(...pos, sceneW, sceneH);
      const value = step.scene.value;
      if ("dominoes" in value) {
        const value = topLevelValueForStep(step, traceTree, defs) as any;

        const cellSize = 20;

        function gridToXY([x, y]: [number, number]): [number, number] {
          return [pos[0] + 10 + cellSize * x, pos[1] + 20 + cellSize * y];
        }

        // grid squares
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#70665a";
        for (let c = 0; c < value.width; c++) {
          for (let r = 0; r < value.height; r++) {
            ctx.rect(...gridToXY([c, r]), cellSize, cellSize);
          }
        }
        ctx.moveTo(...gridToXY([0, 0]));
        ctx.lineTo(...gridToXY([value.width, 0]));
        ctx.moveTo(...gridToXY([0, 0]));
        ctx.lineTo(...gridToXY([0, value.height]));
        ctx.stroke();

        // dominoes
        ctx.beginPath();
        ctx.fillStyle = "brown";
        for (const domino of value.dominoes) {
          ctx.rect(
            ...add(gridToXY(domino[0]), [5, 5]),
            (domino[1][0] - domino[0][0] + 1) * cellSize - 10,
            (domino[1][1] - domino[0][1] + 1) * cellSize - 10,
          );
        }
        ctx.fill();

        // layers
        const path = framePathForStep(step, traceTree);
        path.pop(); // remove current frame
        let x = 0;
        let y = 0;
        let width = value.width;
        let height = value.height;
        for (const segment of path) {
          const frame =
            defs.flowcharts[segment.flowchartId].frames[segment.frameId];
          const action = frame.action as Action & { type: "call" };
          const lens = action.lens!; // TODO: what if not here
          x += lens.dx;
          y += lens.dy;
          width -= lens.dx;
          height -= lens.dy;
          // shaded background
          ctx.beginPath();
          ctx.rect(...pos, sceneW, sceneH);
          ctx.rect(...gridToXY([x, y]), width * cellSize, height * cellSize);
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.fill("evenodd");
          // outline
          ctx.beginPath();
          ctx.rect(...gridToXY([x, y]), width * cellSize, height * cellSize);
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = "rgba(255,255,0,0.8)";
          ctx.stroke();
        }
      } else {
        renderOutlinedText(JSON.stringify(value, null, 2), [
          pos[0] + sceneW / 2,
          pos[1] + sceneH / 2,
        ]);
      }
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

      c.style.cursor = mouseDown
        ? "url('./assets/glove2.png'), pointer"
        : shiftHeld
          ? "url('./assets/glove1.png'), pointer"
          : "url('./assets/glove3.png'), pointer";

      // draw background
      const pattern = ctx.createPattern(img2, "repeat")!;
      ctx.fillStyle = pattern;
      pattern.setTransform(new DOMMatrix().translate(...pan, 0));
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
        if (!prevStackXs.every((x) => x !== undefined)) return 0;

        const myX = Math.max(initX, ...prevStackXs) + sceneW + scenePad;
        const myPos = [myX, myY] as [number, number];

        xFromStack.set(stack, myX);

        let i = 0;
        let j = 0;
        for (const step of stack) {
          ctx.save();
          if (i > 0) ctx.globalAlpha = 0.6;
          renderScene(step, add(myPos, v(i * 10)));
          ctx.restore();
          let action = flowchart.frames[step.frameId].action;
          let label = !action
            ? ""
            : action.type === "test-func"
              ? (action.label ?? "some action")
              : action.type === "call"
                ? `call ${action.flowchartId}`
                : `[${action.type}]`;
          renderOutlinedText(label + "", [myX, myY], "left");

          const myJ = j;
          for (const nextStep of nextSteps(traceTree, step)) {
            if (j > myJ) {
              // draw connector line
              ctx.beginPath();
              ctx.moveTo(
                myX + sceneW,
                myY + myJ * (sceneH + scenePad) + sceneH / 2,
              );
              ctx.lineTo(
                myX + sceneW + scenePad,
                myY + j * (sceneH + scenePad) + sceneH / 2,
              );
              ctx.strokeStyle = "yellow";
              ctx.lineWidth = 2;
              ctx.stroke();
            }
            const v = renderTrace(
              stackFromStepId[nextStep.id],
              { stacks, stackFromStepId },
              initX,
              myY + j * (sceneH + scenePad),
              xFromStack,
            );
            // renderOutlinedText(v + "", [
            //   myX + sceneW + scenePad,
            //   myY + j * (sceneH + scenePad),
            // ]);
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
        [c.width - 250, c.height - 240],
        [300, 300],
      );
      //render candle glow
      const radialFlickerAmt = Math.random() * 12;
      const radialCenter = [c.width - 100, c.height - 150] as [number, number];
      const gradient = ctx.createRadialGradient(
        ...radialCenter,
        30 - radialFlickerAmt,
        ...radialCenter,
        c.width - radialFlickerAmt,
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
