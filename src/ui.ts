import seedrandom from "seedrandom";
import { dominoFlowchart } from "./dominoes.ex";
import {
  addEscapeRoute,
  appendFrameAfter,
  deleteFrame,
  setAction,
} from "./edits";
import {
  Action,
  Definitions,
  Flowchart,
  Frame,
  Stack,
  StackPath,
  StackPathSegment,
  Step,
  TraceTree,
  Viewchart,
  getActionText,
  getNextStacksInLevel,
  getPrevStacksInLevel,
  isEscapeRoute,
  makeTraceTree,
  putStepsInStacks,
  runAll,
  stackPathForStep,
  stackPathToString,
  stepsInStacksToViewchart,
  topLevelValueForStep,
} from "./interpreter";
import { howManyTimesDidModWrap, mod } from "./number";
import { makeCandleRenderer, renderSpriteSheet } from "./ui_candle";
import { renderOutlinedText } from "./ui_text";
import {
  XYWH,
  fillRect,
  fillRectGradient,
  inXYWH,
  loadAudio,
  loadImg,
  saveFile,
} from "./ui_util";
import { assertNever, indexById } from "./util";
import { Vec2, add, v } from "./vec2";

(window as any).DEBUG = true;
function DEBUG() {
  return (window as any).DEBUG;
}

// just fyi ;)
const zodiac = [
  "♈︎",
  "♉︎",
  "♊︎",
  "♋︎",
  "♌︎",
  "♍︎",
  "♎︎",
  "♏︎",
  "♐︎",
  "♑︎",
  "♒︎",
  "♓︎",
];

type UIState = {
  initialValue: unknown;
  initialFlowchartId: string;
  defs: Definitions;
};

const examples = (<T extends Record<string, UIState>>(value: T) => value)({
  dominoesBlank: {
    initialValue: {
      width: 4,
      height: 2,
      dominoes: [],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: indexById<Flowchart>([
        {
          id: "♌︎",
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
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: indexById<Flowchart>([dominoFlowchart]),
    },
  },
  dominoesSimpleRecurse: {
    initialValue: {
      width: 2,
      height: 2,
      dominoes: [],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
            },
            "0.8910228818433734": {
              id: "0.8910228818433734",
              action: {
                type: "place-domino",
                domino: [
                  [0, 0],
                  [0, 1],
                ],
              },
            },
            "0.9228344533853508": {
              id: "0.9228344533853508",
              action: {
                type: "call",
                flowchartId: "♌︎",
                lens: {
                  type: "domino-grid",
                  dx: 1,
                  dy: 0,
                },
              },
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.8910228818433734",
            },
            {
              from: "0.8910228818433734",
              to: "0.9228344533853508",
            },
          ],
        },
      },
    },
  },
  dominoesUntakenPaths: {
    initialValue: {
      width: 4,
      height: 2,
      dominoes: [],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
            },
            "0.6747159926440511": {
              id: "0.6747159926440511",
              action: {
                type: "place-domino",
                domino: [
                  [3, 0],
                  [4, 0],
                ],
              },
            },
            "0.3405055595336326": {
              id: "0.3405055595336326",
              action: {
                type: "place-domino",
                domino: [
                  [1, 1],
                  [1, 2],
                ],
              },
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.6747159926440511",
            },
            {
              from: "1",
              to: "0.3405055595336326",
            },
          ],
        },
      },
    },
  },
  cardsBlank: {
    initialValue: {
      type: "workspace",
      contents: [
        ["K", "Q", "J", "A"],
        ["♠", "♣", "♦", "♥"],
      ],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: indexById<Flowchart>([
        {
          id: "♌︎",
          initialFrameId: "1",
          frames: indexById([{ id: "1", action: { type: "start" } }]),
          arrows: [],
        },
      ]),
    },
  },
  cardsDone: {
    initialValue: {
      type: "workspace",
      contents: [
        ["K", "Q", "J", "A"],
        ["♠", "♣", "♦", "♥"],
      ],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
            },
            "0.24659405590061168": {
              id: "0.24659405590061168",
              action: {
                type: "workspace-pick",
                source: 0,
                index: "any",
                target: {
                  type: "after",
                  index: 1,
                },
              },
            },
            "0.013947261497014196": {
              id: "0.013947261497014196",
              action: {
                type: "workspace-pick",
                source: 1,
                index: "any",
                target: {
                  type: "at",
                  index: 2,
                  side: "after",
                },
              },
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.24659405590061168",
            },
            {
              from: "0.24659405590061168",
              to: "0.013947261497014196",
            },
          ],
        },
      },
    },
  },
  cardsKingOrQueen: {
    initialValue: {
      type: "workspace",
      contents: [
        ["K", "Q", "J", "A"],
        ["♠", "♣", "♦", "♥"],
      ],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
            },
            "0.04794261153881885": {
              id: "0.04794261153881885",
              action: {
                type: "workspace-pick",
                source: 0,
                index: 0,
                target: {
                  type: "after",
                  index: 1,
                },
              },
            },
            "0.7527806732090643": {
              id: "0.7527806732090643",
              action: {
                type: "workspace-pick",
                source: 0,
                index: 1,
                target: {
                  type: "after",
                  index: 1,
                },
              },
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.04794261153881885",
            },
            {
              from: "1",
              to: "0.7527806732090643",
            },
          ],
        },
      },
    },
  },
  cardsMakeRoomForStacks: {
    initialValue: {
      type: "workspace",
      contents: [
        ["K", "Q", "J", "A"],
        ["♠", "♣", "♦", "♥"],
      ],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
            },
            "0.39794335085601507": {
              id: "0.39794335085601507",
              action: {
                type: "workspace-pick",
                source: 0,
                index: "any",
                target: {
                  type: "after",
                  index: 1,
                },
              },
            },
            "0.5130787171417488": {
              id: "0.5130787171417488",
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.39794335085601507",
            },
            {
              from: "1",
              to: "0.5130787171417488",
            },
          ],
        },
      },
    },
  },
  reverseBlank: {
    initialValue: {
      type: "workspace",
      contents: [["a", "b", "c", "d"], []],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: indexById<Flowchart>([
        {
          id: "♌︎",
          initialFrameId: "1",
          frames: indexById([{ id: "1", action: { type: "start" } }]),
          arrows: [],
        },
      ]),
    },
  },
  reverseDone: {
    initialValue: {
      type: "workspace",
      contents: [["a", "b", "c", "d"], []],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
              escapeRouteFrameId: "0.9120936509806226",
            },
            "0.06121677045049312": {
              id: "0.06121677045049312",
              action: {
                type: "workspace-pick",
                source: 0,
                index: "last",
                target: {
                  type: "at",
                  index: 1,
                  side: "after",
                },
              },
            },
            "0.5121800283236944": {
              id: "0.5121800283236944",
              action: {
                type: "call",
                flowchartId: "♌︎",
              },
            },
            "0.9120936509806226": {
              id: "0.9120936509806226",
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.06121677045049312",
            },
            {
              from: "0.06121677045049312",
              to: "0.5121800283236944",
            },
          ],
        },
      },
    },
  },
});

// DEFAULT FLOWCHART RIGHT HERE BUDDY
let undoStack: UIState[] = [examples.cardsMakeRoomForStacks];
let redoStack: UIState[] = [];

const pushState = (newState: UIState) => {
  undoStack.push(newState);
  redoStack = [];
};

const modifyFlowchart = (
  flowchartId: string,
  modification: (old: Flowchart) => Flowchart,
) => {
  const newState = structuredClone(state);
  newState.defs.flowcharts[flowchartId] = modification(
    newState.defs.flowcharts[flowchartId],
  );
  pushState(newState);
};

const persistantValuesById = new Map();
const interpTo = (
  id: string,
  targetValue: any,
  initValue = targetValue,
  slowness = 3,
) => {
  let v = persistantValuesById.get(id);
  if (v === undefined) {
    persistantValuesById.set(id, initValue);
    v = initValue;
  }
  const newValue = v + (targetValue - v) / slowness;
  persistantValuesById.set(id, newValue);
  return newValue;
};
const set = (id: string, value: any) => {
  persistantValuesById.set(id, value);
  return value;
};

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
  loadAudio("./assets/ambient.wav"),
]).then(([imgParchment, imgAsfault, imgCandleSheet, audAmbient]) => {
  const patternParchment = ctx.createPattern(imgParchment, "repeat")!;
  const patternAsfault = ctx.createPattern(imgAsfault, "repeat")!;

  const renderCandle = makeCandleRenderer(ctx, imgCandleSheet);

  let clickables: {
    xywh: XYWH;
    callback: Function;
  }[] = [];

  // start ambient audio
  audAmbient.loop = true;
  audAmbient.start();

  let pan = [0, 0] as [number, number];

  let tool:
    | { type: "pointer" }
    | { type: "domino"; orientation: "h" | "v" }
    | { type: "call"; flowchartId: string }
    | {
        type: "workspace-pick";
        source: number;
        index: number;
        stackPath: StackPath;
        value: unknown;
      }
    | {
        type: "purging-flame";
      } = {
    type: "pointer",
  };

  // set up cursor stuff
  let shiftHeld = false;
  let altHeld = false;
  window.addEventListener("keydown", (e) => {
    if (e.key === "Shift") {
      shiftHeld = true;
    }
    if (e.key === "Alt") {
      altHeld = true;
    }
    if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (undoStack.length > 1) {
        redoStack.push(undoStack.pop()!);
      }
    }
    if (e.key === "y" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (redoStack.length > 0) {
        undoStack.push(redoStack.pop()!);
      }
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
          pushState(examples[key]);
          return;
        }
      }
      window.alert("Can't find that, sorry.");
    }
    if (e.key === "h") {
      tool = { type: "domino", orientation: "h" };
    }
    if (e.key === "v") {
      tool = { type: "domino", orientation: "v" };
    }
    if (e.key === "Escape") {
      tool = { type: "pointer" };
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "Shift") {
      shiftHeld = false;
    }
    if (e.key === "Alt") {
      altHeld = false;
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
  c.addEventListener("mousedown", () => {
    mouseDown = true;
    for (const { xywh, callback } of clickables) {
      if (inXYWH(mouseX, mouseY, xywh)) {
        callback();
        return; // only click one thing at a time
      }
    }
    tool = { type: "pointer" };
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
      pushState(state);
    };
    reader.readAsText(file);
    draggedOver = false;
  });

  c.addEventListener("wheel", (e) => {
    e.preventDefault();
    pan[0] += -e.deltaX;
    pan[1] += -e.deltaY;
  });

  const renderParchmentBox = (
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { empty?: boolean } = {},
  ) => {
    const { empty = false } = opts;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,1)";
    ctx.shadowOffsetY = 4;
    ctx.shadowBlur = 15;
    if (empty) {
      ctx.globalAlpha = 0.3;
    }
    ctx.drawImage(imgParchment, Math.random(), Math.random(), w, h, x, y, w, h);
    if (empty) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(183,167,148)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }
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
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.fillStyle = "#25221E";
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
    ctx.restore();
  };

  const renderDominoes = (value: any, path: StackPath, pos: Vec2) => {
    const { defs } = state;

    function gridToXY([x, y]: [number, number]): [number, number] {
      return [pos[0] + 10 + cellSize * x, pos[1] + 20 + cellSize * y];
    }

    // precompute overall offset of the bottom call
    let dx = 0;
    let dy = 0;
    for (const segment of path.callPath) {
      const frame =
        defs.flowcharts[segment.flowchartId].frames[segment.frameId];
      const action = frame.action as Action & { type: "call" };
      const lens = action.lens!; // TODO: what if not here
      dx += lens.dx;
      dy += lens.dy;
    }

    const { flowchartId, frameId } = path.final;
    const frame = defs.flowcharts[flowchartId].frames[frameId];

    // grid squares
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#70665a";
    let hoveredCell: [number, number] | undefined = undefined;
    for (let c = 0; c < value.width; c++) {
      for (let r = 0; r < value.height; r++) {
        const xywh = [...gridToXY([c, r]), cellSize, cellSize] as const;
        ctx.rect(...xywh);
        if (!frame.action) {
          if (inXYWH(mouseX, mouseY, xywh)) {
            hoveredCell = [c, r];
          }
          if (tool.type === "domino") {
            const { orientation } = tool;
            clickables.push({
              xywh,
              callback: () => {
                const { flowchartId, frameId } = path.final;
                modifyFlowchart(flowchartId, (old) =>
                  setAction(old, frameId, {
                    type: "place-domino",
                    domino: [
                      [c - dx, r - dy],
                      add(
                        [c - dx, r - dy],
                        orientation === "h" ? [1, 0] : [0, 1],
                      ),
                    ],
                  }),
                );
                tool = { type: "pointer" };
              },
            });
          }
          if (tool.type === "call") {
            const callFlowchartId = tool.flowchartId;
            clickables.push({
              xywh,
              callback: () => {
                const { flowchartId, frameId } = path.final;
                modifyFlowchart(flowchartId, (old) =>
                  setAction(old, frameId, {
                    type: "call",
                    flowchartId: callFlowchartId,
                    lens: {
                      type: "domino-grid",
                      dx: c - dx,
                      dy: r - dy,
                    },
                  }),
                );
                tool = { type: "pointer" };
              },
            });
          }
        }
      }
    }
    ctx.moveTo(...gridToXY([0, 0]));
    ctx.lineTo(...gridToXY([value.width, 0]));
    ctx.moveTo(...gridToXY([0, 0]));
    ctx.lineTo(...gridToXY([0, value.height]));
    ctx.stroke();

    if (tool.type === "call" && hoveredCell) {
      ctx.strokeStyle = "rgba(255,200,0,0.8)";
      ctx.strokeRect(
        ...gridToXY(hoveredCell),
        cellSize * (value.width - hoveredCell[0]),
        cellSize * (value.height - hoveredCell[1]),
      );
    }

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
    for (const [i, segment] of path.callPath.entries()) {
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
        ctx.globalAlpha = i === path.callPath.length - 1 ? 0.8 : 0.4;
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

  const renderWorkspace = (
    contents: unknown[][],
    path: StackPath,
    pos: Vec2,
    frame: Frame,
  ) => {
    const hasAction = !!frame.action;
    const isDropTarget =
      path &&
      !hasAction &&
      tool.type === "workspace-pick" &&
      stackPathToString(tool.stackPath) === stackPathToString(path);

    let curY = pos[1] + 10;

    if (isDropTarget) {
      renderDropTargetLine(
        pos[0] + 10,
        curY - 5,
        pos[0] + sceneW - 20,
        curY - 5,
        { type: "after", index: -1 },
      );
    }

    for (let [idxInWorkspace, item] of contents.entries()) {
      if (idxInWorkspace > 0) {
        curY += 5;
      }
      const { maxY } = renderWorkspaceValue(
        item,
        idxInWorkspace,
        path,
        [pos[0] + 10, curY],
        hasAction,
      );
      curY = maxY;

      if (isDropTarget) {
        curY += 5;
        renderDropTargetLine(pos[0] + 10, curY, pos[0] + sceneW - 20, curY, {
          type: "after",
          index: idxInWorkspace,
        });
      }
    }

    if (tool.type === "call" && !hasAction) {
      const xywh = [pos[0], pos[1], sceneW, sceneH] as const;
      const callFlowchartId = tool.flowchartId;
      if (inXYWH(mouseX, mouseY, xywh)) {
        ctx.fillStyle = "rgba(255,200,0,0.4)";
        ctx.fillRect(...xywh);
      }
      clickables.push({
        xywh,
        callback: () => {
          const { flowchartId, frameId } = path.final;
          modifyFlowchart(flowchartId, (old) =>
            setAction(old, frameId, {
              type: "call",
              flowchartId: callFlowchartId,
            }),
          );
          tool = { type: "pointer" };
        },
      });
    }
  };

  const renderWorkspaceValue = (
    value: any,
    idxInWorkspace: number,
    path: StackPath | undefined,
    pos: Vec2,
    hasAction = false,
  ): { maxY: number } => {
    const isDropTarget =
      path &&
      !hasAction &&
      tool.type === "workspace-pick" &&
      stackPathToString(tool.stackPath) === stackPathToString(path);

    let left = pos[0];

    if (isDropTarget) {
      renderDropTargetLine(left - 5, pos[1], left - 5, pos[1] + cellSize, {
        type: "at",
        index: idxInWorkspace,
        side: "before",
      });
    }

    // grid squares
    for (let [i, item] of value.entries()) {
      const cellPos = [left + cellSize * i, pos[1] + cellSize * 0] as const;
      const xywh = [...cellPos, cellSize, cellSize] as const;

      // the box
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#70665a";
      ctx.rect(...xywh);
      ctx.stroke();
      if (tool.type === "pointer" && path && !hasAction) {
        if (inXYWH(mouseX, mouseY, xywh)) {
          ctx.fillStyle = "rgba(255,200,0,0.4)";
          ctx.fill();
        }
        clickables.push({
          xywh,
          callback: () => {
            tool = {
              type: "workspace-pick",
              source: idxInWorkspace,
              index: i,
              stackPath: path,
              value: item,
            };
          },
        });
      }

      // the text
      ctx.font = "14px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillText(
        typeof item === "string" ? item : JSON.stringify(item),
        ...add(cellPos, v(cellSize / 2)),
      );

      if (
        isDropTarget &&
        tool.type === "workspace-pick" &&
        tool.source === idxInWorkspace &&
        tool.index === i
      ) {
        ctx.fillStyle = "rgba(200,200,200,1)";
        ctx.fillRect(...xywh);
      }
    }
    ctx.beginPath();
    ctx.moveTo(left, pos[1]);
    ctx.lineTo(left, pos[1] + cellSize);
    ctx.stroke();
    if (isDropTarget) {
      renderDropTargetLine(
        left + cellSize / 2,
        pos[1] + cellSize / 2,
        left + cellSize * value.length - cellSize / 2,
        pos[1] + cellSize / 2,
        {
          type: "at",
          index: idxInWorkspace,
          side: "replace",
        },
      );
    }

    left += cellSize * value.length;
    left += 5;

    if (isDropTarget) {
      renderDropTargetLine(left, pos[1], left, pos[1] + cellSize, {
        type: "at",
        index: idxInWorkspace,
        side: "after",
      });
    }

    return { maxY: pos[1] + cellSize };
  };

  const renderDropTargetLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    target: (Action & { type: "workspace-pick" })["target"],
  ) => {
    const xywh = [x1 - 3, y1 - 3, x2 - x1 + 6, y2 - y1 + 6] as const;
    ctx.save();
    ctx.strokeStyle = inXYWH(mouseX, mouseY, xywh)
      ? "rgba(255,200,0,0.8)"
      : "#70665a";
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
    clickables.push({
      xywh,
      callback: () => {
        if (tool.type === "workspace-pick") {
          console.log("applying", target);
          const { source, index, stackPath } = tool;
          const { flowchartId, frameId } = stackPath.final;
          modifyFlowchart(flowchartId, (old) =>
            setAction(old, frameId, {
              type: "workspace-pick",
              source,
              index,
              target,
            }),
          );
          tool = { type: "pointer" };
        }
      },
    });
  };

  const renderScene = (step: Step, topleft: Vec2) => {
    const { defs } = state;

    const isOutlined = traceTree.finalStepIds.includes(step.id);

    if (isOutlined) {
      ctx.save();
      ctx.shadowColor = "white";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "white";
      ctx.rect(...topleft, sceneW, sceneH);
      ctx.stroke();
      ctx.restore();
    }
    renderParchmentBox(...topleft, sceneW, sceneH);
    const value = step.scene.value;
    if ("dominoes" in value) {
      const value = topLevelValueForStep(step, traceTree, defs) as any;
      renderDominoes(value, stackPathForStep(step, traceTree), topleft);
    } else if (value.type === "workspace") {
      const frame = defs.flowcharts[step.flowchartId].frames[step.frameId];
      renderWorkspace(
        value.contents,
        stackPathForStep(step, traceTree),
        topleft,
        frame,
      );
    } else {
      renderOutlinedText(
        ctx,
        JSON.stringify(value, null, 2),
        [topleft[0] + 10, topleft[1] + 10],
        { textAlign: "left", textBaseline: "top" },
      );
    }

    if (tool.type === "purging-flame") {
      clickables.push({
        xywh: [topleft[0], topleft[1], sceneW, sceneH] as const,
        callback: () => {
          const { flowchartId, frameId } = stackPathForStep(
            step,
            traceTree,
          ).final;
          modifyFlowchart(flowchartId, (old) => deleteFrame(old, frameId));
          tool = { type: "pointer" };
        },
      });
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
    (window as any).traceTree = traceTree;
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
    runAll(initStep, defs, traceTree, 0);

    clickables = [];

    c.style.cursor =
      tool.type === "pointer"
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
      const paddedEndX = end[0] - 10;
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
    const xFromStack: Record<string, number> = {}; // keyed by stackPathToString

    const renderViewchart = (
      viewchart: Viewchart,
      topLeft: Vec2,
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
      // lighten
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(
        curX,
        curY + callTopPad,
        maxX + callPad - curX,
        maxY + callPad - curY - callTopPad,
      );
      // darken
      ctx.fillStyle = `rgba(0, 0, 0, ${0.15 * callPath.length})`;
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

    const renderEscapeRouteMark = (centerPos: Vec2, onClick?: Function) => {
      const markRadius = 10;

      // ⛧

      ctx.save();

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,1)";
      ctx.shadowOffsetY = 4;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(...centerPos, markRadius, 0, 2 * Math.PI);
      ctx.fillStyle = patternParchment;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(128,0,0,0.6)";
      ctx.fill();

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.font = "25px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⛧", ...add(centerPos, v(0, 3)));
      ctx.restore();

      if (onClick) {
        clickables.push({
          xywh: [
            centerPos[0] - markRadius,
            centerPos[1] - markRadius,
            markRadius * 2,
            markRadius * 2,
          ],
          callback: onClick,
        });
      }
    };
    const escapeRouteDropY = sceneH;

    const renderStack = (
      stack: Stack,
      curX: number,
      myY: number,
      actuallyDraw: boolean,
    ): { maxY: number } => {
      const stackPathString = stackPathToString(stack.stackPath);
      const steps = stack.stepIds.map((stepId) => traceTree.steps[stepId]);

      let stackFanTarget = inXYWH(mouseX, mouseY, [curX, myY, sceneW, sceneH])
        ? 1
        : 0;

      const sv = interpTo(stackPathString, stackFanTarget, 0);
      const stackFan = sv * (84 - 14) + 14;

      let maxY = myY;

      for (const [stepIdx, step] of steps.entries()) {
        const defaultX = curX;
        const defaultY = myY + stepIdx * stackFan;
        if (inXYWH(mouseX, mouseY, [curX, myY, sceneW, sceneH])) {
          const modArgs = [
            myY + stepIdx * stackFan,
            c.height - sceneH,
            myY,
          ] as const;
          if (actuallyDraw)
            drawQueue.push(() => {
              renderScene(step, [
                interpTo(
                  stackPathString + stepIdx + "x",
                  curX +
                    Math.floor(howManyTimesDidModWrap(...modArgs)) * sceneW,
                ),
                interpTo(stackPathString + stepIdx + "y", mod(...modArgs)),
              ]);
            });
        } else {
          if (actuallyDraw)
            drawQueue.push(() => {
              renderScene(step, [
                set(stackPathString + stepIdx + "x", defaultX),
                set(stackPathString + stepIdx + "y", defaultY),
              ]);
            });
        }
        maxY = Math.max(maxY, defaultY + sceneH);
      }
      if (stack.stepIds.length === 0) {
        if (actuallyDraw)
          drawQueue.push(() => {
            renderParchmentBox(curX, myY, sceneW, sceneH, { empty: true });
          });
        maxY = Math.max(maxY, myY + sceneH);
      }

      return { maxY };
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
      const prevStackXs = prevStacks.map(
        (stack) => xFromStack[stackPathToString(stack.stackPath)],
      );
      if (!prevStackXs.every((x) => x !== undefined))
        return { maxX: -Infinity, maxY: -Infinity, final: [] };

      const myX = Math.max(
        initX,
        Math.max(...prevStackXs) + sceneW + scenePadX,
      );

      let curX = myX;
      let curY = myY;

      let maxY = myY;

      const { flowchartId, frameId } = stack.stackPath.final;
      const flowchart = defs.flowcharts[flowchartId];
      const frame = flowchart.frames[frameId];
      const steps = stack.stepIds.map((stepId) => traceTree.steps[stepId]);

      // render call, if any
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
      const stackPathString = stackPathToString(stack.stackPath);
      xFromStack[stackPathString] = curX;
      const stackSize = renderStack(stack, curX, myY, actuallyDraw);
      maxY = Math.max(maxY, stackSize.maxY);
      if (actuallyDraw) {
        let label = getActionText(flowchart.frames[frameId].action);
        drawQueue.push(() =>
          renderOutlinedText(ctx, label, [curX, myY], { textAlign: "left" }),
        );
        if (frame.action?.type === "workspace-pick") {
          const action = frame.action;
          const index = action.index;
          clickables.push({
            xywh: [curX, myY - 6, sceneW, 12],
            callback: () => {
              modifyFlowchart(flowchartId, (old) =>
                setAction(
                  old,
                  frameId,
                  {
                    ...action,
                    index:
                      typeof index === "number"
                        ? "first"
                        : index === "first"
                          ? "last"
                          : index === "last"
                            ? "any"
                            : "first",
                  },
                  true,
                ),
              );
            },
          });
        }

        const buttonRadius = 20;

        if (
          inXYWH(mouseX, mouseY, [curX + sceneW, myY, buttonRadius, sceneH])
        ) {
          // draw semi-circle on the right
          ctx.beginPath();
          ctx.arc(curX + sceneW + 10, myY + sceneH / 2, 5, 0, Math.PI * 2);
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
              modifyFlowchart(flowchartId, (old) =>
                appendFrameAfter(old, frameId),
              );
            },
          });
        }

        if (isEscapeRoute(frameId, flowchart)) {
          renderEscapeRouteMark([curX - scenePadX / 2, myY + sceneH / 2]);
        }
      }

      // render downstream
      let maxX = curX + sceneW + scenePadX;
      const nextStacks = getNextStacksInLevel(stack, stepsInStacks, defs);
      const final: Vec2[] = [];
      let lastConnectionJoint: Vec2 = [
        curX + sceneW + scenePadX,
        myY + sceneH / 2,
      ]; // hacky thing to position unused escape routes or escape-route ghosts
      if (nextStacks.length === 0) {
        final.push([curX, myY]);
      }
      for (const [i, nextStack] of nextStacks.entries()) {
        if (
          isEscapeRoute(nextStack.stackPath.final.frameId, flowchart) &&
          nextStack.stepIds.length === 0
        ) {
          // don't draw it for real; just draw a mark below lastConnectionJoint
          const markPos = add(lastConnectionJoint, [0, escapeRouteDropY]);
          renderConnectorLine(lastConnectionJoint, markPos);
          renderEscapeRouteMark(markPos);
          for (let i = 0; i < 3; i++) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(
              markPos[0] + 10 + (i + 1) * 10,
              markPos[1],
              2,
              0,
              2 * Math.PI,
            );
            ctx.fillStyle = "black";
            ctx.fill();
            ctx.restore();
          }
          maxY = Math.max(maxY, markPos[1]);
          continue;
        }

        if (i > 0) curY += scenePadY;

        // draw connector line

        const start = [curX + sceneW, myY + sceneH / 2] as Vec2;
        const end = [curX + sceneW + scenePadX, curY + sceneH / 2] as Vec2;
        renderConnectorLine(start, end);
        lastConnectionJoint = [
          curX + sceneW + scenePadX / 2,
          curY + sceneH / 2,
        ];

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

      // do we need an escape route?
      if (steps.some((step) => step.isStuck) && !frame.escapeRouteFrameId) {
        const markPos = add(lastConnectionJoint, [0, escapeRouteDropY]);
        renderConnectorLine(lastConnectionJoint, markPos);
        renderEscapeRouteMark(markPos, () => {
          if (!frame.escapeRouteFrameId) {
            console.log("no escape route");
            modifyFlowchart(flowchartId, (old) => addEscapeRoute(old, frameId));
          }
        });
        // ctx.save();
        // ctx.textAlign = "left";
        // ctx.textBaseline = "middle";
        // ctx.font = "30px serif";
        // ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        // ctx.fillText("!?", ...add(markPos, v(10, 0)));
        // ctx.restore();
        renderOutlinedText(ctx, "!?", add(markPos, v(15, 0)), {
          textAlign: "left",
          textBaseline: "middle",
          size: 20,
        });

        maxY = Math.max(maxY, markPos[1]);
      }

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
    const topLevel = renderViewchart(viewchart, add(pan, v(100)), true);
    // is there more than one final stack?
    const finalStacks = Object.values(viewchart.stackByFrameId).filter(
      (stack) => traceTree.finalStepIds.includes(stack.stepIds[0]),
    );
    if (finalStacks.length > 1) {
      const extraX = 100;
      renderConnectorLine(
        [topLevel.maxX, pan[1] + sceneW / 2 + 100],
        [topLevel.maxX + extraX, pan[1] + sceneW / 2 + 100],
      );
      renderStack(
        {
          stackPath: {
            callPath: [],
            final: { flowchartId: state.initialFlowchartId, frameId: "FINAL" },
          },
          stepIds: traceTree.finalStepIds,
        },
        topLevel.maxX + extraX,
        pan[1] + 100,
        true,
      );
    }
    for (const f of drawQueue) f();

    const labelPt = add(pan, v(100, 40));
    renderOutlinedText(ctx, state.initialFlowchartId, labelPt, {
      textAlign: "left",
      textBaseline: "top",
      size: 40,
      family: "mono",
    });
    if (tool.type === "pointer") {
      clickables.push({
        xywh: [...labelPt, 40, 40],
        callback: () => {
          tool = { type: "call", flowchartId: state.initialFlowchartId };
        },
      });
    }

    if (tool.type === "pointer") {
      // handled by css cursor
    } else if (tool.type === "domino") {
      renderDomino(mouseX, mouseY, tool.orientation);
    } else if (tool.type === "call") {
      renderOutlinedText(ctx, state.initialFlowchartId, [mouseX, mouseY], {
        size: 40,
      });
    } else if (tool.type === "workspace-pick") {
      renderWorkspaceValue(
        [tool.value],
        0,
        undefined,
        add([mouseX, mouseY], v(-cellSize / 2)),
      );
    } else if (tool.type === "purging-flame") {
      renderSpriteSheet(
        ctx,
        imgCandleSheet,
        1,
        127,
        10,
        [100, 100],
        [mouseX - 156, mouseY - 72],
        [300, 300],
      );
    } else {
      assertNever(tool);
    }

    renderDomino(
      c.width - 250,
      c.height - 30 - (cellSize - dominoPadding * 2),
      "h",
      () => {
        tool = { type: "domino", orientation: "h" };
      },
    );
    renderDomino(
      c.width - 200,
      c.height - 30 - (2 * cellSize - dominoPadding * 2),
      "v",
      () => {
        tool = { type: "domino", orientation: "v" };
      },
    );

    renderCandle();

    clickables.push({
      xywh: [ctx.canvas.width - 145, ctx.canvas.height - 160, 90, 130],
      callback: () => {
        tool = { type: "purging-flame" };
      },
    });

    (window as any).DEBUG = false;

    if (draggedOver) {
      ctx.fillStyle = "rgba(128, 255, 128, 0.5)";
      ctx.fillRect(0, 0, c.width, c.height);
    }

    // mouse position debug
    if (false) {
      ctx.fillStyle = "white";
      ctx.fillRect(mouseX - 100, mouseY, 200, 1);
      ctx.fillRect(mouseX, mouseY - 100, 1, 200);
    }

    if (altHeld) {
      ctx.strokeStyle = "rgba(255, 0, 255, 1)";
      ctx.lineWidth = 4;
      for (const clickable of clickables) {
        ctx.strokeRect(...clickable.xywh);
      }
    }
  }
});
