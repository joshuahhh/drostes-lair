import seedrandom from "seedrandom";
import { dominoFlowchart } from "./dominoes.ex";
import { appendFrameAfter, setAction } from "./edits";
import {
  Action,
  Definitions,
  Flowchart,
  Stack,
  StackPath,
  StackPathSegment,
  Step,
  TraceTree,
  Viewchart,
  getActionText,
  getNextStacksInLevel,
  getPrevStacksInLevel,
  makeTraceTree,
  putStepsInStacks,
  runAll,
  stackPathForStep,
  stepsInStacksToViewchart,
  topLevelValueForStep,
} from "./interpreter";
import { makeCandleRenderer } from "./ui_candle";
import { makeOutlinedTextRenderer } from "./ui_text";
import {
  XYWH,
  fillRect,
  fillRectGradient,
  inXYWH,
  loadAudio,
  loadImg,
  saveFile,
} from "./ui_util";
import { indexById } from "./util";
import { Vec2, add, v } from "./vec2";

(window as any).DEBUG = true;
function DEBUG() {
  return (window as any).DEBUG;
}

type UIState = {
  initialValue: unknown;
  initialFlowchartId: string;
  defs: Definitions;
};

const examples: Record<string, UIState> = {
  dominoesBlank: {
    initialValue: {
      width: 4,
      height: 2,
      dominoes: [],
    },
    initialFlowchartId: "fc1",
    defs: {
      flowcharts: indexById<Flowchart>([
        {
          id: "fc1",
          initialFrameId: "1",
          frames: indexById([{ id: "1", action: { type: "start" } }]),
          arrows: [],
        },
      ]),
    },
  },
  dominoesComplete: {
    initialValue: {
      width: 4,
      height: 2,
      dominoes: [],
    },
    initialFlowchartId: "fc1",
    defs: {
      flowcharts: indexById<Flowchart>([dominoFlowchart]),
    },
  },
};

let undoStack: UIState[] = [examples.dominoesBlank];

// globals for communication are the best
let state: UIState;
let traceTree: TraceTree;

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
    imgParchment,
    imgAsfault,
    imgCandleSheet,
    imgGlovePoint,
    imgGloveGrab,
    audVocal,
    audAmbient,
  ]) => {
    const patternParchment = ctx.createPattern(imgParchment, "repeat")!;
    const patternAsfault = ctx.createPattern(imgAsfault, "repeat")!;

    const renderOutlinedText = makeOutlinedTextRenderer(ctx);
    const renderCandle = makeCandleRenderer(
      ctx,
      imgCandleSheet,
      renderOutlinedText,
    );

    let clickables: {
      xywh: XYWH;
      callback: Function;
    }[] = [];

    // start ambient audio
    audAmbient.loop = true;
    audAmbient.start();

    let pan = [0, 0] as [number, number];

    let tool: "pointer" | "domino-h" | "domino-v" = "pointer";

    // set up cursor stuff
    let shiftHeld = false;
    window.addEventListener("keydown", (e) => {
      if (e.key === "Shift") {
        shiftHeld = true;
      }
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        undoStack.pop();
      }
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveFile(
          new Blob([JSON.stringify(state, null, 2)], {
            type: "application/json;charset=utf-8",
          }),
          "state.json",
        );
      }
      if (e.key === "o" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        let prompt = "Select # or key of example to load:\n";
        for (const [i, key] of Object.keys(examples).entries()) {
          prompt += `${i + 1}. ${key}\n`;
        }
        prompt += "(To load a file, drop it onto the canvas.)";
        const result = window.prompt(prompt);
        if (!result) return;
        for (const [i, key] of Object.keys(examples).entries()) {
          if (result === key || result === `${i + 1}`) {
            undoStack.push(examples[key]);
            return;
          }
        }
        window.alert("Can't find that, sorry.");
      }
      if (e.key === "h") {
        tool = "domino-h";
      }
      if (e.key === "v") {
        tool = "domino-v";
      }
      if (e.key === "Escape") {
        tool = "pointer";
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === "Shift") {
        shiftHeld = false;
      }
    });

    let mouseX = 0;
    let mouseY = 0;
    let mouseDown = false;
    c.addEventListener("mousemove", (e) => {
      // add "feel good" numbers for the shape of the cursor
      mouseX = e.offsetX + 7;
      mouseY = e.offsetY + 3;
    });
    c.addEventListener("mousedown", (e) => {
      mouseDown = true;
      if (e.offsetX > 550 && e.offsetY > 550) audVocal.start();
      for (const { xywh, callback } of clickables) {
        if (inXYWH(mouseX, mouseY, xywh)) callback();
      }
    });
    c.addEventListener("mouseup", () => {
      mouseDown = false;
    });
    let draggedOver = false;
    c.addEventListener("dragover", (e) => {
      draggedOver = true;
      e.preventDefault(); // important for drop?
    });
    c.addEventListener("dragleave", (e) => {
      draggedOver = false;
    });
    c.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer!.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        state = JSON.parse(reader.result as string);
        undoStack.push(state);
      };
      reader.readAsText(file);
      draggedOver = false;
    });

    const renderParchmentBox = (x: number, y: number, w: number, h: number) => {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,1)";
      ctx.shadowOffsetY = 4;
      ctx.shadowBlur = 15;
      ctx.drawImage(
        imgParchment,
        Math.random(),
        Math.random(),
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

    const cellSize = 20;
    const dominoPadding = 5;

    const renderDomino = (
      x: number,
      y: number,
      orientation: "h" | "v",
      onClick?: () => void,
    ) => {
      ctx.beginPath();
      ctx.fillStyle = "#4D2725";
      const xywh = [
        x - cellSize / 2 + dominoPadding,
        y - cellSize / 2 + dominoPadding,
        orientation === "h"
          ? cellSize * 2 - dominoPadding * 2
          : cellSize - dominoPadding * 2,
        orientation === "v"
          ? cellSize * 2 - dominoPadding * 2
          : cellSize - dominoPadding * 2,
      ] as const;
      ctx.rect(...xywh);
      if (onClick) {
        clickables.push({ xywh, callback: onClick });
      }
      ctx.fill();
    };

    const renderDominoes = (value: any, path: StackPath, pos: Vec2) => {
      const { defs } = state;

      function gridToXY([x, y]: [number, number]): [number, number] {
        return [pos[0] + 10 + cellSize * x, pos[1] + 20 + cellSize * y];
      }

      // grid squares
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#70665a";
      for (let c = 0; c < value.width; c++) {
        for (let r = 0; r < value.height; r++) {
          const xywh = [...gridToXY([c, r]), cellSize, cellSize] as const;
          ctx.rect(...xywh);
          if (tool === "domino-h" || tool === "domino-v") {
            clickables.push({
              xywh,
              callback: () => {
                let dx = 0;
                let dy = 0;
                for (const segment of path.callPath) {
                  const frame =
                    defs.flowcharts[segment.flowchartId].frames[
                      segment.frameId
                    ];
                  const action = frame.action as Action & { type: "call" };
                  const lens = action.lens!; // TODO: what if not here
                  dx += lens.dx;
                  dy += lens.dy;
                }
                const { flowchartId, frameId } = path.final;
                const newState = structuredClone(state);
                newState.defs.flowcharts[flowchartId] = setAction(
                  state.defs.flowcharts[flowchartId],
                  frameId,
                  {
                    type: "place-domino",
                    domino: [
                      [c - dx, r - dy],
                      add(
                        [c - dx, r - dy],
                        tool === "domino-h" ? [1, 0] : [0, 1],
                      ),
                    ],
                    failureFrameId: "base-case",
                  },
                );
                undoStack.push(newState);
                tool = "pointer";
              },
            });
          }
        }
      }

      ctx.moveTo(...gridToXY([0, 0]));
      ctx.lineTo(...gridToXY([value.width, 0]));
      ctx.moveTo(...gridToXY([0, 0]));
      ctx.lineTo(...gridToXY([0, value.height]));
      ctx.stroke();

      // dominoes
      for (const domino of value.dominoes) {
        const orientation = domino[0][0] === domino[1][0] ? "v" : "h";
        renderDomino(
          ...add(gridToXY(domino[0]), [cellSize / 2, cellSize / 2]),
          orientation,
        );
      }

      // lens layers
      let x = 0;
      let y = 0;
      let width = value.width;
      let height = value.height;
      for (const segment of path.callPath) {
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
        // use parchment fade or darkness fade?
        if (true) {
          ctx.fillStyle = patternParchment;
          patternParchment.setTransform(new DOMMatrix().translate(...pan, 0));
          ctx.globalAlpha = 0.4;
        } else {
          ctx.fillStyle = "rgba(0,0,0,0.4)";
        }
        ctx.fill("evenodd");
        ctx.globalAlpha = 1;
        // outline
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(...gridToXY([x, y]), width * cellSize, height * cellSize);
        // ctx.setLineDash([2, 2]);
        ctx.strokeStyle = "rgba(255,200,0,0.8)";
        ctx.stroke();
      }
    };

    const renderScene = (
      step: Step,
      pos: [number, number], // TODO: rename: is this the top left corner?
    ) => {
      const { defs } = state;

      const isOutlined = traceTree.finalStepIds.includes(step.id);

      if (isOutlined) {
        ctx.shadowColor = "white";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "white";
        ctx.rect(...pos, sceneW, sceneH);
        ctx.stroke();
      }
      renderParchmentBox(...pos, sceneW, sceneH);
      const value = step.scene.value;
      if ("dominoes" in value) {
        const value = topLevelValueForStep(step, traceTree, defs) as any;
        renderDominoes(value, stackPathForStep(step, traceTree), pos);
      } else {
        renderOutlinedText(JSON.stringify(value, null, 2), [
          pos[0] + sceneW / 2,
          pos[1] + sceneH / 2,
        ]);
      }
    };

    // panning
    c.addEventListener("mousemove", (e) => {
      if (e.shiftKey) {
        pan[0] += e.movementX;
        pan[1] += e.movementY;
      }
    });

    requestAnimationFrame(drawLoop);

    function drawLoop() {
      requestAnimationFrame(drawLoop);

      state = undoStack.at(-1)!;
      const { defs } = state;

      // run program on every frame lol
      traceTree = makeTraceTree();
      // TODO: hardcoding the first flowchart
      const flowchart = state.defs.flowcharts[state.initialFlowchartId];
      const initStep = {
        id: "*",
        prevStepId: undefined,
        flowchartId: flowchart.id,
        frameId: flowchart.initialFrameId,
        scene: { value: state.initialValue },
        caller: undefined,
      };
      runAll(initStep, defs, traceTree);

      clickables = [];

      c.style.cursor =
        tool === "pointer"
          ? mouseDown
            ? "url('./assets/glove2.png'), pointer"
            : shiftHeld
              ? "url('./assets/glove1.png'), pointer"
              : "url('./assets/glove3.png'), pointer"
          : "none";

      // draw background
      ctx.fillStyle = patternAsfault;
      patternAsfault.setTransform(new DOMMatrix().translate(...pan, 0));
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(0, 0, c.width, c.height);

      const renderConnectorLine = (start: Vec2, end: Vec2) => {
        const middleX = start[0] + (end[0] - start[0]) / 2;
        const paddedEndX = end[0] - 25;
        const jointX = Math.max(middleX, paddedEndX);
        ctx.save();
        ctx.beginPath();
        ctx.globalAlpha = 0.9;
        ctx.globalCompositeOperation = "multiply";
        ctx.moveTo(...start);
        ctx.lineTo(...[jointX, start[1]]);
        ctx.lineTo(...[jointX, end[1]]);
        ctx.lineTo(...end);
        ctx.strokeStyle = "rgb(170, 3, 37)";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
      };

      // render trace
      const scenePadX = 20;
      const scenePadY = 40;
      const callPad = 20;
      const callTopPad = 20;
      const xFromStack = new Map<Stack, number>();

      const renderViewchart = (
        viewchart: Viewchart,
        topLeft: [number, number],
        actuallyDraw: boolean,
      ): {
        maxX: number;
        maxY: number;
      } => {
        const flowchart = defs.flowcharts[viewchart.flowchartId];
        const initialStack = viewchart.stackByFrameId[flowchart.initialFrameId];
        const r = renderStackAndDownstream(
          initialStack,
          ...topLeft,
          viewchart,
          actuallyDraw,
        );

        for (const v of r.final) {
          renderConnectorLine(add(v, [sceneW, sceneH / 2]), [
            r.maxX,
            topLeft[1] + sceneH / 2,
          ]);
        }

        const start = add(topLeft, v(-scenePadX, sceneH / 2));
        const end = add(start, v(scenePadX, 0));
        renderConnectorLine(start, end);

        return r;
      };

      const renderInset = (
        callPath: StackPathSegment[],
        curX: number,
        curY: number,
        maxX: number,
        maxY: number,
      ) => {
        ctx.fillStyle = patternAsfault;
        const rng = seedrandom(JSON.stringify(callPath));
        patternAsfault.setTransform(
          new DOMMatrix().translate(
            ...add(pan, [rng() * 1000, rng() * 1000]),
            100,
          ),
        );
        ctx.fillRect(
          curX,
          curY + callTopPad,
          maxX + callPad - curX,
          maxY + callPad - curY - callTopPad,
        );
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(
          curX,
          curY + callTopPad,
          maxX + callPad - curX,
          maxY + callPad - curY - callTopPad,
        );
        ctx.fillStyle = `rgba(0, 0, 0, ${0.1 * callPath.length})`;
        ctx.fillRect(
          curX,
          curY + callTopPad,
          maxX + callPad - curX,
          maxY + callPad - curY - callTopPad,
        );
        // shadows (via gradients inset from the edges)
        // left
        fillRectGradient(
          ctx,
          curX,
          curY + 10,
          15,
          maxY + callPad - curY - 10,
          "rgba(0,0,0,0.7)",
          "rgba(0,0,0,0)",
          "H",
        );
        // right
        fillRectGradient(
          ctx,
          maxX + callPad,
          curY + 10,
          -15,
          maxY + callPad - curY - 10,
          "rgba(0,0,0,0.7)",
          "rgba(0,0,0,0)",
          "H",
        );
        // bottom
        fillRectGradient(
          ctx,
          curX,
          maxY + callPad,
          maxX + callPad - curX,
          -5,
          "rgba(0,0,0,0.2)",
          "rgba(0,0,0,0)",
          "V",
        );
        // top
        fillRect(ctx, curX, curY, maxX + callPad - curX, 20, "rgba(0,0,0,0.4)");
        fillRectGradient(
          ctx,
          curX,
          curY + 20,
          maxX + callPad - curX,
          -10,
          "rgba(0,0,0,0.7)",
          "rgba(0,0,0,0)",
          "V",
        );
        fillRectGradient(
          ctx,
          curX,
          curY + 20,
          maxX + callPad - curX,
          10,
          "rgba(0,0,0,0.8)",
          "rgba(0,0,0,0)",
          "V",
        );
      };

      // saves things to draw for later,
      // so they are drawn on-top of other things
      const drawQueue: Function[] = [];
      /**
       * returns maximum X & Y values reached
       */
      const renderStackAndDownstream = (
        stack: Stack,
        /* initial x-position – only used for the starting stack. other fellas consult xFromStack */
        initX: number,
        myY: number,
        viewchart: Viewchart,
        actuallyDraw: boolean,
      ): {
        maxX: number;
        maxY: number;
        final: Vec2[];
      } => {
        const prevStacks = getPrevStacksInLevel(stack, stepsInStacks, defs);
        const prevStackXs = prevStacks.map((stack) => xFromStack.get(stack));
        if (!prevStackXs.every((x) => x !== undefined))
          return { maxX: -Infinity, maxY: -Infinity, final: [] };

        const myX = Math.max(
          initX,
          Math.max(...prevStackXs) + sceneW + scenePadX,
        );

        let curX = myX;
        let curY = myY;

        let maxY = myY + sceneH;

        // render call, if any
        const { flowchartId, frameId } = stack.stackPath.final;
        const flowchart = defs.flowcharts[flowchartId];
        const frame = flowchart.frames[frameId];
        if (frame.action?.type === "call") {
          const childViewchart = viewchart.callViewchartsByFrameId[frameId] as
            | Viewchart
            | undefined;
          if (childViewchart) {
            // measure child (will be overdrawn)
            const child = renderViewchart(
              childViewchart,
              [curX + callPad, curY + callPad + callTopPad],
              false,
            );
            maxY = Math.max(maxY, child.maxY + callPad);

            if (actuallyDraw)
              renderInset(
                childViewchart.callPath,
                curX,
                curY,
                child.maxX - callPad,
                child.maxY + callPad,
              );

            // draw child for real
            if (actuallyDraw) {
              renderConnectorLine(
                [child.maxX + callPad, curY + sceneH / 2],
                [child.maxX + callPad - scenePadX, curY + sceneH / 2],
              );
              renderViewchart(
                childViewchart,
                [curX + callPad, curY + callPad + callTopPad],
                actuallyDraw,
              );
            }
            curX = child.maxX + callPad;
          }
        }

        // render stack
        xFromStack.set(stack, curX);
        if (actuallyDraw) {
          drawQueue.push(() => {
            for (const [stepIdx, stepId] of stack.stepIds.entries()) {
              const step = traceTree.steps[stepId];
              ctx.save();
              renderScene(step, add([curX, myY], v(0, stepIdx * 14)));
              ctx.restore();
              let label = getActionText(flowchart.frames[step.frameId].action);
              renderOutlinedText(label, [curX, myY], "left");
            }

            const buttonRadius = 10;

            if (
              tool === "pointer" &&
              inXYWH(mouseX, mouseY, [curX, myY, sceneW + buttonRadius, sceneH])
            ) {
              // draw semi-circle on the right
              ctx.beginPath();
              ctx.arc(
                curX + sceneW,
                myY + sceneH / 2,
                buttonRadius,
                (3 * Math.PI) / 2,
                Math.PI / 2,
              );
              ctx.fillStyle = patternParchment;
              ctx.fill();

              clickables.push({
                xywh: [
                  curX + sceneW - buttonRadius,
                  myY + sceneH / 2 - buttonRadius,
                  buttonRadius * 2,
                  buttonRadius * 2,
                ],
                callback: () => {
                  const newState = structuredClone(state);
                  newState.defs.flowcharts[flowchartId] = appendFrameAfter(
                    flowchart,
                    frameId,
                  );
                  undoStack.push(newState);
                },
              });
            }
          });
        }

        // render downstream
        let maxX = curX + sceneW + scenePadX;
        const nextStacks = getNextStacksInLevel(stack, stepsInStacks, defs);
        const final: Vec2[] = [];
        if (nextStacks.length === 0) {
          final.push([curX, myY]);
        }
        for (const [i, nextStack] of nextStacks.entries()) {
          if (i > 0) curY += scenePadY;

          // draw connector line

          const start = [curX + sceneW, myY + sceneH / 2] as Vec2;
          const end = [curX + sceneW + scenePadX, curY + sceneH / 2] as Vec2;
          renderConnectorLine(start, end);

          const child = renderStackAndDownstream(
            nextStack,
            initX,
            curY,
            viewchart,
            actuallyDraw,
          );
          for (const v of child.final) final.push(v);

          maxX = Math.max(maxX, child.maxX);
          curY = child.maxY;
        }
        maxY = Math.max(maxY, curY);

        // debug box
        if (false) {
          ctx.beginPath();
          ctx.rect(myX, myY, maxX - myX, curY - myY);
          ctx.fillStyle = "rgba(255,0,0,0.2)";
          // ctx.lineWidth = 2;
          ctx.fill();
        }

        return { maxX, maxY, final };
      };
      const stepsInStacks = putStepsInStacks(traceTree);
      const viewchart = stepsInStacksToViewchart(stepsInStacks);
      renderViewchart(viewchart, add(pan, v(100)), true);
      for (const f of drawQueue) f();
      // renderStackAndDownstream(
      //   stepsInStacks.stackByStepId[initStepId],
      //   ...add(pan, v(100)),
      // );

      if (tool === "domino-h" || tool === "domino-v") {
        renderDomino(mouseX, mouseY, tool === "domino-h" ? "h" : "v");
      }

      renderDomino(
        c.width - 250,
        c.height - 30 - (cellSize - dominoPadding * 2),
        "h",
        () => {
          tool = "domino-h";
        },
      );
      renderDomino(
        c.width - 200,
        c.height - 30 - (2 * cellSize - dominoPadding * 2),
        "v",
        () => {
          tool = "domino-v";
        },
      );

      renderCandle();
      (window as any).DEBUG = false;

      if (draggedOver) {
        ctx.fillStyle = "rgba(128, 255, 128, 0.5)";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        ctx.font = "24px sans-serif";
      }

      // mouse position debug
      if (false) {
        ctx.fillStyle = "white";
        ctx.fillRect(mouseX - 100, mouseY, 200, 1);
        ctx.fillRect(mouseX, mouseY - 100, 1, 200);
      }
    }
  },
);
