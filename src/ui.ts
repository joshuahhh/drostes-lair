import { detect as detectBrowser } from "detect-browser";
import {
  addEscapeRoute,
  appendFrameAfter,
  deleteFrame,
  setAction,
  setActionOnFrameOrAfter,
} from "./edits";
import {
  Action,
  Definitions,
  Flowchart,
  Frame,
  Scene,
  Stack,
  StackPath,
  StackPathSegment,
  Step,
  SuccessfulStep,
  TraceTree,
  Viewchart,
  assertSuccessful,
  getActionText,
  getNextStacksInLevel,
  isEscapeRoute,
  makeTraceTree,
  putStepsInStacks,
  runAll,
  stackPathForStep,
  stackPathToString,
  stepsInStacksToViewchart,
  stringifyEqual,
  topLevelValueForStep,
} from "./interpreter";
import { Layer, getLayerCommandCount, layer } from "./layer";
import { howManyTimesDidModWrap, mod } from "./number";
import { makeCandleRenderer, renderSpriteSheet } from "./ui_candle";
import { examples } from "./ui_examples";
import { UIState } from "./ui_state";
import { renderOutlinedText } from "./ui_text";
import {
  XYWH,
  expand,
  fillRect,
  fillRectGradient,
  inXYWH,
  loadAudio,
  loadImg,
  saveFile,
} from "./ui_util";
import { assertNever, indexById } from "./util";
import { Vec2, add, mul, v } from "./vec2";

const browser = detectBrowser();

(window as any).DEBUG = true;
function DEBUG() {
  return (window as any).DEBUG;
}

function debugPoint(lyr: Layer, pos: Vec2) {
  lyr.save();
  lyr.beginPath();
  lyr.arc(...pos, 5, 0, 2 * Math.PI);
  lyr.fillStyle = "yellow";
  lyr.fill();
  lyr.restore();
}

function debugLine(lyr: Layer, a: Vec2, b: Vec2) {
  lyr.save();
  lyr.beginPath();
  lyr.moveTo(...a);
  lyr.lineTo(...b);
  lyr.lineWidth = 2;
  lyr.strokeStyle = "yellow";
  lyr.stroke();
  lyr.restore();
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

const zodiacRankedInOrderOfCoolness = [
  "♌︎",
  "♋︎",
  "♈︎",
  "♉︎",
  "♊︎",
  "♍︎",
  "♎︎",
  "♐︎",
  "♑︎",
  "♒︎",
  "♓︎",
  "♏︎",
];

let callHueSaturation = "249deg 37%";

// Nested `act` calls are supposed to be batched – the nested calls
// shouldn't separately commit changes to the undo stack. This global
// variable marks that a call is nested, and provides the mutable
// state for the batch.
let curStateYouCanChange: UIState | undefined = undefined;
const act = (f: (stateYouCanChange: UIState) => void) => {
  if (!curStateYouCanChange) {
    // we're the top-level call
    curStateYouCanChange = structuredClone(state);
    f(curStateYouCanChange);
    pushState(curStateYouCanChange);
    curStateYouCanChange = undefined;
  } else {
    // we're nested
    f(curStateYouCanChange);
  }
};

// DEFAULT FLOWCHART RIGHT HERE BUDDY
let undoStack: UIState[] = [examples.dominoesBlank];
let redoStack: UIState[] = [];

const maybeFromLocalStorage = localStorage.getItem("panda-stacks");
if (maybeFromLocalStorage) {
  ({ undoStack, redoStack } = JSON.parse(maybeFromLocalStorage));
}

const pushState = (newState: UIState) => {
  undoStack.push(newState);
  redoStack = [];
  syncStacks();
};

const syncStacks = () => {
  localStorage.setItem(
    "panda-stacks",
    JSON.stringify({ undoStack, redoStack }),
  );
};

const modifyFlowchart = (
  flowchartId: string,
  modification: (old: Flowchart) => Flowchart,
) => {
  act((state) => {
    state.defs.flowcharts[flowchartId] = modification(
      state.defs.flowcharts[flowchartId],
    );
  });
};

const ensureFlowchartExists = (flowchartId: string) => {
  act((state) => {
    if (!state.defs.flowcharts[flowchartId]) {
      state.defs.flowcharts[flowchartId] = {
        id: flowchartId,
        initialFrameId: "1",
        frames: indexById([{ id: "1", action: { type: "start" } }]),
        arrows: [],
      };
    }
  });
};

let viewDepth = Infinity;

const persistentValuesById = new Map<string, number>();
const interpTo = (
  id: string,
  targetValue: number,
  initValue = targetValue,
  slowness = 3,
) => {
  let v = persistentValuesById.get(id);
  if (v === undefined) {
    persistentValuesById.set(id, initValue);
    v = initValue;
  }
  const newValue = v + (targetValue - v) / slowness;
  persistentValuesById.set(id, newValue);
  return newValue;
};

let hoveredStackPathString = undefined as string | undefined;

// globals for communication are the best
let state: UIState;
let traceTree: TraceTree;

const c = document.getElementById("c") as HTMLCanvasElement;
const cContainer = document.getElementById("c-container") as HTMLDivElement;
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;
    c.width = width;
    c.height = height;
  }
});
resizeObserver.observe(cContainer);
const ctxReal = c.getContext("2d")!;

Promise.all([
  loadImg("./parchment.jpg"),
  loadImg("./asfault.jpg"),
  loadImg("./candle_sheet.png"),
  loadAudio("./ambient.mp3"),
]).then(([imgParchment, imgAsfault, imgCandleSheet, audAmbient]) => {
  const patternParchment = ctxReal.createPattern(imgParchment, "repeat")!;
  const patternAsfault = ctxReal.createPattern(imgAsfault, "repeat")!;

  const renderCandle = makeCandleRenderer(imgCandleSheet);

  // don't touch this directly; use addClickHandler
  let _clickables: {
    xywh: XYWH;
    callback: Function;
  }[] = [];

  const addClickHandler = (xywh: XYWH, callback: Function) => {
    _clickables.push({ xywh, callback });
  };

  // start ambient audio
  audAmbient.loop = true;
  audAmbient.start();

  let pan: Vec2 = JSON.parse(localStorage.getItem("pan") + "") ?? [0, 0];
  const setPan = (v: Vec2) => {
    localStorage.setItem("pan", JSON.stringify(v));
    pan = v;
  };

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
      }
    | {
        type: "dev-action";
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
    if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      if (undoStack.length > 1) {
        redoStack.push(undoStack.pop()!);
        syncStacks();
      }
    }
    if (
      (e.key === "y" && (e.ctrlKey || e.metaKey)) ||
      (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)
    ) {
      e.preventDefault();
      if (redoStack.length > 0) {
        undoStack.push(redoStack.pop()!);
        syncStacks();
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
    if (e.key === "p" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setPan([0, 0]);
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
          undoStack = [examples[key as keyof typeof examples]];
          redoStack = [];
          syncStacks();
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
    if (e.key === "a") {
      tool = { type: "dev-action" };
    }
    if (e.key === "i" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const result = window.prompt(
        "JSON for initial value:",
        JSON.stringify(state.initialValue),
      );
      if (!result) return;
      try {
        const newState = { ...state, initialValue: JSON.parse(result) };
        pushState(newState);
      } catch (e) {
        window.alert("Can't read that JSON, sorry.");
      }
    }
    if (e.key >= "1" && e.key <= "9") {
      viewDepth = parseInt(e.key) - 1;
    }
    if (e.key === "0") {
      viewDepth = Infinity;
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
    // clientX/Y works better than offsetX/Y for Chrome/Safari compatibility.

    // add "feel good" numbers for the shape of the cursor
    mouseX = e.clientX + 7;
    mouseY = e.clientY + 3;
  });
  c.addEventListener("mousedown", () => {
    mouseDown = true;
  });
  c.addEventListener("mouseup", () => {
    mouseDown = false;
  });
  c.addEventListener("click", () => {
    for (const { xywh, callback } of _clickables) {
      if (inXYWH(mouseX, mouseY, xywh)) {
        callback();
        return; // only click one thing at a time
      }
    }
    tool = { type: "pointer" };
    return true;
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
    setPan(add(pan, [-e.deltaX, -e.deltaY]));
  });

  const renderParchmentBox = (
    lyr: Layer,
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { empty?: boolean } = {},
  ) => {
    const { empty = false } = opts;
    const xywh = [x, y, w, h] as const;

    lyr.save();
    lyr.shadowColor = "rgba(0,0,0,1)";
    lyr.shadowOffsetY = 4;
    lyr.shadowBlur = 15;
    if (empty) {
      lyr.globalAlpha = 0.3;
    }
    if (browser?.name === "safari") {
      // Safari doesn't seem to draw shadows for drawImage?
      lyr.fillStyle = "black";
      lyr.fillRect(...xywh);
    }
    lyr.drawImage(imgParchment, Math.random(), Math.random(), w, h, ...xywh);
    if (empty) {
      lyr.globalAlpha = 1;
      lyr.strokeStyle = "rgba(183,167,148)";
      lyr.lineWidth = 1;
      lyr.strokeRect(...xywh);
    }
    lyr.restore();
  };
  const sceneW = 100;
  const sceneH = 100;

  const cellSize = 20;
  const dominoPadding = 5;

  const renderDomino = (
    lyr: Layer,
    x: number,
    y: number,
    orientation: "h" | "v",
    justPlaced: boolean,
    opts: {
      onClick?: () => void;
      isBad?: boolean;
    } = {},
  ) => {
    const { onClick, isBad } = opts;

    lyr.save();
    const xywh = expand(
      XYWH(
        x - cellSize / 2,
        y - cellSize / 2,
        orientation === "h" ? cellSize * 2 : cellSize,
        orientation === "v" ? cellSize * 2 : cellSize,
      ),
      -dominoPadding,
    );
    if (justPlaced) {
      lyr.beginPath();
      lyr.fillStyle = isBad ? `rgba(128,0,0,0.5)` : "#fce8a7";
      lyr.shadowColor = isBad ? `rgba(128,0,0,0.5)` : "#fce8a7";
      lyr.shadowBlur = 8;
      lyr.rect(...expand(xywh, 2));
      lyr.fill();
    }
    lyr.beginPath();
    lyr.fillStyle = "#25221E";
    lyr.rect(...xywh);
    lyr.fill();
    if (onClick) {
      addClickHandler(
        [xywh[0] - 10, xywh[1] - 10, xywh[2] + 20, xywh[3] + 20],
        onClick,
      );
    }
    lyr.restore();
  };

  const renderDominoes = (
    lyr: Layer,
    value: {
      width: number;
      height: number;
      dominoes: [[number, number], [number, number]][];
    },
    path: StackPath,
    action: Action | undefined,
    pos: Vec2,
  ) => {
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

    // grid squares
    lyr.beginPath();
    lyr.lineWidth = 3;
    lyr.strokeStyle = "#70665a";
    let hoveredCell: [number, number] | undefined = undefined;
    for (let c = 0; c < value.width; c++) {
      for (let r = 0; r < value.height; r++) {
        const xywh = [...gridToXY([c, r]), cellSize, cellSize] as const;
        lyr.rect(...xywh);
        if (inXYWH(mouseX, mouseY, xywh)) {
          hoveredCell = [c, r];
        }
        if (tool.type === "domino") {
          const { orientation } = tool;
          addClickHandler(xywh, () => {
            const { flowchartId, frameId } = path.final;
            modifyFlowchart(flowchartId, (old) =>
              setActionOnFrameOrAfter(old, frameId, {
                type: "place-domino",
                domino: [
                  [c - dx, r - dy],
                  add([c - dx, r - dy], orientation === "h" ? [1, 0] : [0, 1]),
                ],
              }),
            );
            tool = { type: "pointer" };
          });
        }
        if (tool.type === "call") {
          const callFlowchartId = tool.flowchartId;
          addClickHandler(xywh, () => {
            const { flowchartId, frameId } = path.final;
            act(() => {
              ensureFlowchartExists(callFlowchartId);
              modifyFlowchart(flowchartId, (old) =>
                setActionOnFrameOrAfter(old, frameId, {
                  type: "call",
                  flowchartId: callFlowchartId,
                  lens: {
                    type: "domino-grid",
                    dx: c - dx,
                    dy: r - dy,
                  },
                }),
              );
            });
            tool = { type: "pointer" };
          });
        }
      }
    }
    lyr.moveTo(...gridToXY([0, 0]));
    lyr.lineTo(...gridToXY([value.width, 0]));
    lyr.moveTo(...gridToXY([0, 0]));
    lyr.lineTo(...gridToXY([0, value.height]));
    lyr.stroke();

    if (tool.type === "call" && hoveredCell) {
      const xywh = [
        ...gridToXY(hoveredCell),
        cellSize * (value.width - hoveredCell[0]),
        cellSize * (value.height - hoveredCell[1]),
      ] as const;
      lyr.lineWidth = 2;
      lyr.strokeStyle = `hsl(${callHueSaturation} 45%)`;
      lyr.strokeRect(...xywh);
      lyr.fillStyle = `hsl(${callHueSaturation} 30% / 30%)`;
      lyr.fillRect(...xywh);
    }

    // dominoes
    const lyrTop = lyr.spawnLater(); // so out-of-bounds dominoes go above the lens layers
    for (const domino of value.dominoes) {
      let justPlaced = false;
      if (action?.type === "place-domino") {
        if (
          stringifyEqual(add(domino[0], [-dx, -dy]), action.domino[0]) &&
          stringifyEqual(add(domino[1], [-dx, -dy]), action.domino[1])
        ) {
          justPlaced = true;
        }
      }

      const orientation = domino[0][0] === domino[1][0] ? "v" : "h";
      const isBad =
        domino[0][0] < 0 ||
        domino[1][0] >= value.width ||
        domino[0][1] < 0 ||
        domino[1][1] >= value.height;

      renderDomino(
        justPlaced ? lyrTop : lyr,
        ...add(gridToXY(domino[0]), [cellSize / 2, cellSize / 2]),
        orientation,
        justPlaced,
        { isBad },
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
      lyr.beginPath();
      lyr.rect(...pos, sceneW, sceneH);
      lyr.rect(...gridToXY([x, y]), width * cellSize, height * cellSize);
      // use parchment fade or darkness fade?
      if (true) {
        lyr.fillStyle = patternParchment;
        patternParchment.setTransform(new DOMMatrix().translate(...pan, 0));
        lyr.globalAlpha = i === path.callPath.length - 1 ? 0.8 : 0.4;
      } else {
        lyr.fillStyle = "rgba(0,0,0,0.4)";
      }
      lyr.fill("evenodd");
      lyr.globalAlpha = 1;
      // outline
      lyr.lineWidth = 2;
      lyr.beginPath();
      lyr.rect(...gridToXY([x, y]), width * cellSize, height * cellSize);
      // lyr.setLineDash([2, 2]);
      lyr.strokeStyle = `hsl(${callHueSaturation} 50%)`;
      lyr.stroke();
    }

    lyrTop.place();
  };

  const renderWorkspace = (
    lyr: Layer,
    scene: Scene & { type: "success"; value: { contents: unknown[][] } },
    path: StackPath,
    pos: Vec2,
    opts: { badSource?: number } = {},
  ) => {
    const { badSource } = opts;

    if (scene.type !== "success") {
      throw new Error("bad scene type");
    }

    const lyrTop = lyr.spawnLater(); // so drop target lines go above the contents

    const contents = scene.value.contents;
    let annotation = undefined;
    if (scene.actionAnnotation?.type === "workspace-pick") {
      annotation = scene.actionAnnotation;
    }

    const isDropTarget =
      badSource === undefined &&
      path &&
      tool.type === "workspace-pick" &&
      stackPathToString(tool.stackPath) === stackPathToString(path);

    let curY = pos[1] + 10;

    if (isDropTarget) {
      renderDropTargetLine(
        lyrTop,
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
        lyr,
        lyrTop,
        item,
        idxInWorkspace,
        path,
        [pos[0] + 10, curY],
        {
          removalIdx:
            annotation?.src[0] === idxInWorkspace
              ? annotation?.src[1]
              : undefined,
          insertionIdx:
            annotation?.dst[0] === idxInWorkspace
              ? annotation?.dst[1]
              : undefined,
          isBad: badSource === idxInWorkspace,
          interactable: badSource === undefined,
        },
      );
      curY = maxY;

      if (isDropTarget) {
        curY += 5;
        renderDropTargetLine(
          lyrTop,
          pos[0] + 10,
          curY,
          pos[0] + sceneW - 20,
          curY,
          {
            type: "after",
            index: idxInWorkspace,
          },
        );
      }
    }

    if (tool.type === "call") {
      const xywh = [pos[0], pos[1], sceneW, sceneH] as const;
      const callFlowchartId = tool.flowchartId;
      if (inXYWH(mouseX, mouseY, xywh)) {
        lyr.save();
        lyr.globalAlpha = 0.33;
        lyr.fillStyle = `hsl(${callHueSaturation} 70%)`;
        lyr.fillRect(...xywh);
        lyr.restore();
      }
      addClickHandler(xywh, () => {
        const { flowchartId, frameId } = path.final;
        act(() => {
          ensureFlowchartExists(callFlowchartId);
          modifyFlowchart(flowchartId, (old) =>
            setActionOnFrameOrAfter(old, frameId, {
              type: "call",
              flowchartId: callFlowchartId,
            }),
          );
        });
        tool = { type: "pointer" };
      });
    }

    lyrTop.place();
  };

  const renderWorkspaceValue = (
    lyr: Layer,
    lyrTop: Layer | undefined,
    value: unknown[],
    idxInWorkspace: number,
    path: StackPath | undefined,
    pos: Vec2,
    opt: {
      removalIdx?: number;
      insertionIdx?: number;
      isBad?: boolean;
      interactable?: boolean;
    } = {},
  ): { maxY: number } => {
    const { removalIdx, insertionIdx, isBad, interactable = true } = opt;

    const isDropTarget =
      interactable &&
      path &&
      tool.type === "workspace-pick" &&
      stackPathToString(tool.stackPath) === stackPathToString(path);

    let left = pos[0];

    if (isDropTarget && lyrTop) {
      renderDropTargetLine(
        lyrTop,
        left - 5,
        pos[1],
        left - 5,
        pos[1] + cellSize,
        {
          type: "at",
          index: idxInWorkspace,
          side: "before",
        },
      );
    }

    let cellContents: (
      | { type: "item"; value: unknown; isAdded: boolean }
      | { type: "removal" }
    )[] = value.map((item: unknown, idx: number) => ({
      type: "item",
      value: item,
      isAdded: insertionIdx === idx,
    }));
    if (removalIdx !== undefined) {
      cellContents.splice(
        insertionIdx !== undefined && insertionIdx < removalIdx
          ? removalIdx + 1
          : removalIdx,
        0,
        { type: "removal" },
      );
    }

    const lyrRemoval = lyr.spawnLater();

    // grid squares
    for (let [i, cell] of cellContents.entries()) {
      const isInsertion = cell.type === "item" && cell.isAdded;
      const isRemoval = cell.type === "removal";

      const cellPos = [left + cellSize * i, pos[1] + cellSize * 0] as const;
      const xywh = [...cellPos, cellSize, cellSize] as const;

      (isRemoval ? lyrRemoval : lyr).do((lyr) => {
        // the box
        if (isInsertion || isRemoval) {
          lyr.save();
          lyr.beginPath();
          lyr.fillStyle = "#fce8a7";
          lyr.shadowColor = "#fce8a7";
          lyr.shadowBlur = 8;
          lyr.rect(...expand(xywh, 2));
          lyr.fill();
          lyr.restore();
        }
        lyr.beginPath();
        lyr.lineWidth = 3;
        lyr.strokeStyle = isBad ? `rgba(128,0,0,0.5)` : "#70665a";
        if (isRemoval) {
          lyr.setLineDash([4, 4]);
        }
        lyr.rect(...xywh);
        lyr.stroke();
        lyr.setLineDash([]);
        if (interactable && !isRemoval && tool.type === "pointer" && path) {
          if (inXYWH(mouseX, mouseY, xywh)) {
            lyr.fillStyle = "rgba(255,200,0,0.4)";
            lyr.fill();
          }
          if (cell.type === "item")
            addClickHandler(xywh, () => {
              tool = {
                type: "workspace-pick",
                source: idxInWorkspace,
                index: i,
                stackPath: path,
                value: cell.value,
              };
            });
        }

        // the text
        if (cell.type === "item") {
          lyr.font = "14px serif";
          lyr.textAlign = "center";
          lyr.textBaseline = "middle";
          lyr.fillStyle = "rgba(0,0,0,0.8)";
          lyr.fillText(
            typeof cell.value === "string"
              ? cell.value
              : JSON.stringify(cell.value),
            ...add(cellPos, v(cellSize / 2)),
          );
        }

        if (
          isDropTarget &&
          tool.type === "workspace-pick" &&
          tool.source === idxInWorkspace &&
          tool.index === i
        ) {
          lyr.fillStyle = "rgba(200,200,200,1)";
          lyr.fillRect(...xywh);
        }
      });
    }
    if (cellContents.length === 0) {
      lyr.beginPath();
      lyr.lineWidth = 3;
      lyr.strokeStyle = isBad ? `rgba(128,0,0,0.5)` : "#70665a";
      lyr.moveTo(left, pos[1]);
      lyr.lineTo(left, pos[1] + cellSize);
      lyr.stroke();
    }
    if (isDropTarget && lyrTop) {
      renderDropTargetLine(
        lyrTop,
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
      renderDropTargetLine(lyr, left, pos[1], left, pos[1] + cellSize, {
        type: "at",
        index: idxInWorkspace,
        side: "after",
      });
    }

    lyrRemoval.place();

    return { maxY: pos[1] + cellSize };
  };

  const renderDropTargetLine = (
    lyr: Layer,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    target: (Action & { type: "workspace-pick" })["target"],
  ) => {
    const xywh = [x1 - 3, y1 - 3, x2 - x1 + 6, y2 - y1 + 6] as const;
    lyr.save();
    lyr.strokeStyle = inXYWH(mouseX, mouseY, xywh)
      ? "rgba(255,200,0,0.8)"
      : "#70665a";
    lyr.lineWidth = 3;
    lyr.setLineDash([2, 2]);
    lyr.beginPath();
    lyr.moveTo(x1, y1);
    lyr.lineTo(x2, y2);
    lyr.stroke();
    lyr.restore();
    addClickHandler(xywh, () => {
      if (tool.type === "workspace-pick") {
        const { source, index, stackPath } = tool;
        const { flowchartId, frameId } = stackPath.final;
        modifyFlowchart(flowchartId, (old) =>
          setActionOnFrameOrAfter(old, frameId, {
            type: "workspace-pick",
            source,
            index,
            target,
          }),
        );
        tool = { type: "pointer" };
      }
    });
  };

  const renderSceneValue = (
    lyr: Layer,
    step: Step,
    value: any,
    frame: Frame,
    defs: Definitions,
    topLeft: Vec2,
  ) => {
    value = topLevelValueForStep(step, value, traceTree, defs) as any;

    lyr.save();
    lyr.beginPath();
    lyr.rect(...topLeft, sceneW, sceneH);
    lyr.clip();

    if (typeof value === "object" && value !== null && "dominoes" in value) {
      renderDominoes(
        lyr,
        value as any,
        stackPathForStep(step, traceTree),
        frame.action,
        topLeft,
      );
    } else if (
      typeof value === "object" &&
      value !== null &&
      "type" in value &&
      value.type === "workspace"
    ) {
      // TODO: renderSceneValue is a big mess
      renderWorkspace(
        lyr,
        {
          type: "success",
          value,
          actionAnnotation: (step.scene as any).actionAnnotation,
        },
        stackPathForStep(step, traceTree),
        topLeft,
      );
    } else {
      renderOutlinedText(
        lyr,
        JSON.stringify(value, null, 2) ?? "idk",
        [topLeft[0] + 10, topLeft[1] + 10],
        { textAlign: "left", textBaseline: "top" },
      );
    }

    lyr.restore();
  };

  const renderScene = (
    lyr: Layer,
    step: Step,
    topleft: Vec2,
    onHover: () => void,
  ) => {
    const { defs } = state;

    const frame = defs.flowcharts[step.flowchartId].frames[step.frameId];

    const xywh = [...topleft, sceneW, sceneH] as const;
    if (inXYWH(mouseX, mouseY, expand(xywh, 10))) {
      onHover();
    }

    const isOutlined = traceTree.finalStepIds.includes(step.id);

    if (isOutlined) {
      lyr.save();
      lyr.shadowColor = "white";
      lyr.shadowBlur = 10;
      lyr.beginPath();
      lyr.lineWidth = 4;
      lyr.strokeStyle = "white";
      lyr.rect(...xywh);
      lyr.stroke();
      lyr.restore();
    }
    // if (step.scene.type === "error") {
    //   lyr.save();
    //   lyr.shadowColor = "white";
    //   lyr.shadowBlur = 10;
    //   lyr.beginPath();
    //   lyr.lineWidth = 4;
    //   lyr.strokeStyle = "#d66047";
    //   lyr.rect(...xywh);
    //   lyr.stroke();
    //   lyr.restore();
    // }
    renderParchmentBox(lyr, ...xywh);
    lyr.do(() => {
      const borderWidth = 1;
      lyr.beginPath();
      lyr.strokeStyle = `#675E53`;
      lyr.lineWidth = borderWidth;
      lyr.stroke;
      lyr.rect(...expand(xywh, -borderWidth / 2));
      lyr.stroke();
    });

    if (step.scene.type === "error") {
      const errorAnnotation = step.scene.errorAnnotation;
      if (errorAnnotation) {
        if (errorAnnotation.type === "workspace-pick-bad-source") {
          renderWorkspace(
            lyr,
            errorAnnotation.scene,
            stackPathForStep(step, traceTree),
            topleft,
            {
              badSource: errorAnnotation.source,
            },
          );
        }
        if (errorAnnotation.type === "scene") {
          renderSceneValue(
            lyr,
            step,
            errorAnnotation.scene.value,
            frame,
            defs,
            topleft,
          );
        }
      }

      lyr.do(() => {
        const borderWidth = 4;
        lyr.beginPath();
        lyr.strokeStyle = `rgba(128,0,0,0.5)`;
        lyr.lineWidth = borderWidth;
        lyr.stroke;
        lyr.rect(...expand(xywh, -borderWidth / 2));
        lyr.fillStyle = "rgba(30,0,0,0.3)";
        lyr.fill();
        lyr.stroke();
      });

      renderOutlinedText(
        lyr,
        step.scene.message,
        [topleft[0] + 10, topleft[1] + sceneH],
        { textAlign: "left", color: "#e8816b" },
      );
      return;
    }
    assertSuccessful(step);

    renderSceneValue(lyr, step, step.scene.value, frame, defs, topleft);

    if (tool.type === "purging-flame") {
      addClickHandler(xywh, () => {
        const { flowchartId, frameId } = step;
        modifyFlowchart(flowchartId, (old) => deleteFrame(old, frameId));
        tool = { type: "pointer" };
      });
    }

    if (tool.type === "dev-action") {
      addClickHandler(xywh, () => {
        const action = frame.action;
        const newActionStr = window.prompt(
          "Enter new action JSON:",
          action === undefined ? "" : JSON.stringify(action),
        );
        if (newActionStr === null) return;
        try {
          const newAction = JSON.parse(newActionStr);
          const { flowchartId, frameId } = step;
          modifyFlowchart(flowchartId, (old) =>
            setAction(old, frameId, newAction, true),
          );
          tool = { type: "pointer" };
        } catch (e) {
          window.alert("Can't read that JSON, sorry.");
        }
      });
    }
  };

  // panning
  c.addEventListener("mousemove", (e) => {
    if (e.shiftKey) {
      setPan(add(pan, [e.movementX, e.movementY]));
    }
  });

  let lastEndTime = performance.now();

  requestAnimationFrame(drawLoop);

  let t = 0;
  function drawLoop() {
    requestAnimationFrame(drawLoop);
    t++;

    // oscillate around violet
    const hueRotation = 250 + Math.sin(t / 100) * 15;
    callHueSaturation = `${hueRotation.toFixed(2)}deg 37%`;

    // console.log("draw");

    // This one will be drawn on the real canvas
    const lyrMain = layer(ctxReal);
    const lyrAbove = lyrMain.spawnLater();

    state = undoStack.at(-1)!;
    (window as any).state = state;
    const { defs } = state;

    // run program on every frame lol
    traceTree = makeTraceTree();
    (window as any).traceTree = traceTree;
    // TODO: hardcoding the first flowchart
    const flowchart = state.defs.flowcharts[state.initialFlowchartId];
    const initStep: SuccessfulStep = {
      id: "*",
      prevStepId: undefined,
      flowchartId: flowchart.id,
      frameId: flowchart.initialFrameId,
      scene: { type: "success", value: state.initialValue },
      caller: undefined,
    };
    runAll(initStep, defs, traceTree, 0);

    _clickables = [];

    c.style.cursor =
      tool.type === "pointer"
        ? mouseDown
          ? "url('./glove2.png'), pointer"
          : shiftHeld
            ? "url('./glove1.png'), pointer"
            : "url('./glove3.png'), pointer"
        : tool.type === "dev-action"
          ? "help"
          : "none";

    // draw background
    ctxReal.fillStyle = patternAsfault;
    patternAsfault.setTransform(new DOMMatrix().translate(...pan, 0));
    ctxReal.fillRect(0, 0, c.width, c.height);
    ctxReal.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctxReal.fillRect(0, 0, c.width, c.height);

    const renderConnectorLine = (lyr: Layer, start: Vec2, end: Vec2) => {
      const middleX = start[0] + (end[0] - start[0]) / 2;
      const paddedEndX = end[0] - 10;
      const jointX = Math.max(middleX, paddedEndX);
      lyr.save();

      lyr.beginPath();
      lyr.globalAlpha = 0.2;
      lyr.globalCompositeOperation = "screen";
      lyr.moveTo(...start);
      lyr.lineTo(...[jointX, start[1]]);
      lyr.lineTo(...[jointX, end[1]]);
      lyr.lineTo(...end);
      lyr.strokeStyle = "rgb(170, 113, 37)";
      lyr.lineWidth = 5;
      lyr.stroke();
      lyr.restore();
    };

    const renderFlowchartSigil = (
      lyr: Layer,
      flowchartId: string,
      pos: Vec2,
      exists: boolean = true,
    ) => {
      renderOutlinedText(lyr, flowchartId, pos, {
        textAlign: "left",
        textBaseline: "top",
        size: 40,
        family: "monospace",
        color: `hsl(${callHueSaturation} 70% ${exists ? "" : "/ 50%"})`,
      });
      if (tool.type === "pointer") {
        addClickHandler([...pos, 40, 40], () => {
          tool = { type: "call", flowchartId };
        });
      }
    };

    // render trace
    const scenePadX = 20;
    const scenePadY = 40;
    const callPad = 20;
    const callTopPad = 20;

    const renderViewchart = (
      lyr: Layer,
      lyrAboveViewchart: Layer,
      viewchart: Viewchart,
      topLeft: Vec2,
    ): {
      maxX: number;
      maxY: number;
    } => {
      const lyrAbove = lyr.spawnLater();
      const lyrBelow = lyr.spawnHere();

      renderFlowchartSigil(
        lyrAbove,
        viewchart.flowchartId,
        add(topLeft, [0, -60]),
      );

      if (viewchart.callPath.length > viewDepth) {
        // TODO: we're backwards-engineering the padding put around
        // the viewchart; this is dumb
        lyr.save();
        for (let i = -1; i < 2; i++) {
          lyr.beginPath();
          lyr.arc(
            topLeft[0] + sceneW / 2 - callPad + i * 20,
            topLeft[1] + sceneH / 2 - callPad,
            5,
            0,
            Math.PI * 2,
          );
          lyr.globalAlpha = 0.5;
          lyr.fillStyle = patternParchment;
          lyr.fill();
        }
        lyr.restore();
        return {
          maxX: topLeft[0] + sceneW - callPad,
          maxY: topLeft[1] + sceneH - 2 * callPad - 2 * callTopPad,
        };
      }

      const flowchart = defs.flowcharts[viewchart.flowchartId];
      const initialStack = viewchart.stackByFrameId[flowchart.initialFrameId];
      const r = renderStackAndDownstream(
        lyr,
        lyrAboveViewchart,
        initialStack,
        ...topLeft,
        viewchart,
      );

      // final connector lines, out of viewchart
      for (const v of r.finalPosForConnector) {
        renderConnectorLine(lyrBelow, v, [
          r.maxX,
          r.finalPosForConnector[0][1],
        ]);
      }

      // initial little connector line on the left
      const start = add(topLeft, v(-scenePadX, sceneH / 2));
      const end = add(start, v(scenePadX, 0));
      renderConnectorLine(lyrBelow, start, end);

      lyrAbove.place();

      return r;
    };

    const renderInset = (
      lyr: Layer,
      callPath: StackPathSegment[],
      curX: number,
      curY: number,
      maxX: number,
      maxY: number,
    ) => {
      const callPathStr = JSON.stringify(callPath);
      const w = interpTo(`inset-${callPathStr}-w`, maxX + callPad - curX);
      const h = interpTo(`inset-${callPathStr}-h`, maxY + callPad - curY);
      lyr.fillStyle = `rgba(0, 0, 0, ${0.15 * callPath.length})`;
      lyr.fillRect(curX, curY + callTopPad, w, h - callTopPad);
      // shadows (via gradients inset from the edges)
      // left
      fillRectGradient(
        lyr,
        curX,
        curY + 10,
        15,
        h - 10,
        "rgba(0,0,0,0.7)",
        "rgba(0,0,0,0)",
        "H",
      );
      // right
      fillRectGradient(
        lyr,
        curX + w,
        curY + 10,
        -15,
        h - 10,
        "rgba(0,0,0,0.7)",
        "rgba(0,0,0,0)",
        "H",
      );
      // bottom
      fillRectGradient(
        lyr,
        curX,
        curY + h,
        w,
        -5,
        "rgba(0,0,0,0.2)",
        "rgba(0,0,0,0)",
        "V",
      );
      // top
      fillRect(lyr, curX, curY, w, 20, "rgba(0,0,0,0.4)");
      fillRectGradient(
        lyr,
        curX,
        curY + 20,
        w,
        -10,
        "rgba(0,0,0,0.7)",
        "rgba(0,0,0,0)",
        "V",
      );
      fillRectGradient(
        lyr,
        curX,
        curY + 20,
        w,
        10,
        "rgba(0,0,0,0.8)",
        "rgba(0,0,0,0)",
        "V",
      );
    };

    const renderEscapeRouteMark = (
      lyr: Layer,
      centerPos: Vec2,
      onClick?: Function,
      disabled?: boolean,
    ) => {
      const markRadius = 13;

      // draw a circle with shadow before drawing
      // the actual circle with texture because it caused perf issues
      // to draw the actual circle with a shadow.
      lyr.save();
      lyr.shadowColor = disabled ? "rgba(0,0,0,0.6)" : `rgba(100,10,10,0.7)`;
      lyr.shadowOffsetY = 2;
      lyr.shadowBlur = 10;
      lyr.beginPath();
      lyr.arc(...centerPos, markRadius, 0, 2 * Math.PI);
      lyr.fill();
      lyr.restore();

      // draw actual circle
      lyr.save();
      lyr.beginPath();
      lyr.arc(...centerPos, markRadius, 0, 2 * Math.PI);
      lyr.fillStyle = patternParchment;
      lyr.fill();
      lyr.restore();
      const flickeringOpacity =
        Math.sin(t / 20) / 30 + 0.5 + Math.random() * 0.05;
      lyr.fillStyle = disabled ? "gray" : `rgba(128,0,0,${flickeringOpacity})`;

      lyr.lineWidth = 1;
      lyr.strokeStyle = disabled ? "black" : `#24130D`;
      lyr.stroke();
      lyr.fill();

      lyr.save();
      lyr.fillStyle = "rgba(0, 0, 0, 0.8)";
      lyr.font = "25px serif";
      lyr.textAlign = "center";
      lyr.textBaseline = "middle";
      lyr.fillText("‡", ...add(centerPos, v(0, 1)));
      lyr.restore();

      if (onClick) {
        addClickHandler(
          [
            centerPos[0] - markRadius,
            centerPos[1] - markRadius,
            markRadius * 2,
            markRadius * 2,
          ],
          onClick,
        );
      }
    };
    const renderEscapeDagger = (lyr: Layer, topPos: Vec2, height: number) => {
      const flickeringOpacity =
        Math.sin(t / 20) / 30 + 0.5 + Math.random() * 0.05;
      lyr.fillStyle = `rgba(162, 91, 79,${flickeringOpacity})`;
      const x = topPos[0];
      const y = topPos[1];
      const w = 4.5;
      const handleW = 15;
      // handle
      lyr.fillRect(
        x - handleW / 2,
        y + 7 + (Math.random() - 0.5),
        handleW / 2 - w / 2,
        w,
      );
      lyr.fillRect(
        x + w / 2,
        y + 7 + (Math.random() - 0.5),
        handleW / 2 - w / 2,
        w,
      );
      lyr.fillRect(
        x - handleW / 2,
        y + height - 25 + (Math.random() - 0.5),
        handleW / 2 - w / 2,
        w,
      );
      lyr.fillRect(
        x + w / 2,
        y + height - 25 + (Math.random() - 0.5),
        handleW / 2 - w / 2,
        w,
      );
      // blade
      lyr.fillRect(
        x - w / 2 + (Math.random() - 0.5),
        y + (Math.random() - 0.5),
        w,
        height,
      );
    };
    const escapeRouteDropY = sceneH;

    const renderStack = (
      lyr: Layer,
      lyrAboveViewchart: Layer,
      stack: Stack,
      curX: number,
      myY: number,
    ): { maxX: number; maxY: number; layerUsed: Layer } => {
      const stackPathString = stackPathToString(stack.stackPath);
      const steps = stack.stepIds.map((stepId) => traceTree.steps[stepId]);

      let maxX = curX;
      let maxY = myY;

      const hovered =
        inXYWH(mouseX, mouseY, [curX, myY, sceneW, sceneH]) ||
        hoveredStackPathString === stackPathString;

      if (hovered) {
        hoveredStackPathString = undefined;
      }

      const layerToUse = hovered ? lyrAboveViewchart : lyr;
      layerToUse.do((lyr) => {
        for (const [stepIdx, step] of steps.entries()) {
          let targetX = curX;
          let targetY = myY + stepIdx * 14;
          if (hovered) {
            const stackFanX = sceneW + 10;
            const stackFanY = sceneH + 10;
            const modArgs = [
              myY + stepIdx * stackFanY,
              c.height - sceneH,
              myY,
            ] as const;
            targetX =
              curX + Math.floor(howManyTimesDidModWrap(...modArgs)) * stackFanX;
            targetY = mod(...modArgs);
          }

          const xy: Vec2 = [
            interpTo(stackPathString + stepIdx + "x", targetX - pan[0]) +
              pan[0],
            interpTo(stackPathString + stepIdx + "y", targetY - pan[1]) +
              pan[1],
          ];
          renderScene(lyr, step, xy, () => {
            hoveredStackPathString = stackPathString;
          });

          if (stepIdx === 0) {
            // TODO: Only one step is used to determine size. This is
            // needed, at least, for consistent connector placement.
            maxX = Math.max(maxX, curX + sceneW);
            maxY = Math.max(maxY, myY + sceneH);
          }
        }
        if (stack.stepIds.length > 1) {
          // render number of steps in stack
          renderOutlinedText(
            lyr,
            `${stack.stepIds.length}`,
            [curX + sceneW, myY],
            {
              textAlign: "right",
              size: 20,
              color: "#BDAA94",
            },
          );
        }
        if (stack.stepIds.length === 0) {
          const w = 60;
          const h = 50;
          renderParchmentBox(lyr, curX, myY, w, h, {
            empty: true,
          });
          maxX = Math.max(maxX, curX + w);
          maxY = Math.max(maxY, myY + h);
        }
      });

      return { maxX, maxY, layerUsed: layerToUse };
    };

    /**
     * returns maximum X & Y values reached
     */
    const renderStackAndDownstream = (
      lyr: Layer,
      lyrAboveViewchart: Layer,
      stack: Stack,
      myX: number,
      myY: number,
      viewchart: Viewchart,
    ): {
      maxX: number;
      maxY: number;
      initialPosForConnector: Vec2 | undefined;
      finalPosForConnector: Vec2[];
    } => {
      const lyrAbove = lyr.spawnLater();
      const lyrBelow = lyr.spawnHere();

      let curX = myX;
      let curY = myY;

      let maxY = myY;

      const { flowchartId, frameId } = stack.stackPath.final;
      const flowchart = defs.flowcharts[flowchartId];
      const frame = flowchart.frames[frameId];
      const steps = stack.stepIds.map((stepId) => traceTree.steps[stepId]);

      // render call, if any
      // curX is lhs of call hole
      let drewCallHole = false;
      if (frame.action?.type === "call") {
        const childViewchart = viewchart.callViewchartsByFrameId[frameId] as
          | Viewchart
          | undefined;
        if (childViewchart) {
          const child = renderViewchart(
            lyrAbove,
            lyrAboveViewchart,
            childViewchart,
            [curX + callPad, curY + callPad + callTopPad],
          );
          maxY = Math.max(maxY, child.maxY + callPad);

          renderInset(
            lyrBelow,
            childViewchart.callPath,
            curX,
            curY,
            child.maxX - callPad,
            child.maxY + callPad,
          );

          // TODO: think about this spacing; seems like call stack
          // should be more attached to call hole?
          curX = child.maxX + callPad;

          drewCallHole = true;
        }
      }

      // render stack
      // curX is now lhs of stack
      const stackPathString = stackPathToString(stack.stackPath);
      // TODO: returning layerUsed feels bad to me
      const renderStackResult = renderStack(
        lyr,
        lyrAboveViewchart,
        stack,
        curX,
        myY,
      );
      const stackH = renderStackResult.maxY - myY;
      if (drewCallHole) {
        renderConnectorLine(
          lyr,
          [curX - scenePadX, curY + stackH / 2],
          [curX, curY + stackH / 2],
        );
      }
      maxY = Math.max(maxY, renderStackResult.maxY);
      let label = getActionText(flowchart.frames[frameId].action);
      if (label.startsWith("call")) {
        // special case to make call sigil look good for Elliot's browser font rendering
        renderOutlinedText(renderStackResult.layerUsed, "call", [curX, myY], {
          textAlign: "left",
        });
        renderOutlinedText(
          renderStackResult.layerUsed,
          label.slice("call".length),
          [curX + 10, myY],
          {
            textAlign: "left",
            size: 19,
            family: "monospace",
            color: `hsl(${callHueSaturation} 70%)`,
          },
        );
      } else {
        renderOutlinedText(renderStackResult.layerUsed, label, [curX, myY], {
          textAlign: "left",
        });
      }
      if (frame.action?.type === "workspace-pick") {
        const action = frame.action;
        const index = action.index;
        addClickHandler([curX, myY - 6, sceneW, 12], () => {
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
        });
      }
      if (isEscapeRoute(frameId, flowchart)) {
        // render escape route mark on-top of escape route frame
        renderEscapeRouteMark(renderStackResult.layerUsed, [
          myX + sceneW / 2,
          myY,
        ]);
      }
      curX = renderStackResult.maxX;

      const buttonRadius = 20;

      if (inXYWH(mouseX, mouseY, [curX, myY, buttonRadius, sceneH])) {
        // draw semi-circle on the right
        lyr.beginPath();
        lyr.arc(curX + 10, myY + sceneH / 2, 5, 0, Math.PI * 2);
        lyr.fillStyle = patternParchment;
        lyr.fill();

        addClickHandler(
          [
            curX - buttonRadius,
            myY + sceneH / 2 - buttonRadius,
            buttonRadius * 2,
            buttonRadius * 2,
          ],
          () => {
            modifyFlowchart(flowchartId, (old) =>
              appendFrameAfter(old, frameId),
            );
          },
        );
      }

      // render downstream
      let maxX = curX + scenePadX;
      const nextStacks = getNextStacksInLevel(stack, stepsInStacks, defs);
      const finalPosForConnectors: Vec2[] = [];
      // hacky thing to position unused escape routes or escape-route ghosts
      let lastConnectionJoint: Vec2 = [curX + scenePadX / 2, myY + sceneH / 2];
      if (nextStacks.length === 0) {
        finalPosForConnectors.push([curX, myY + stackH / 2]);
      }
      for (const [i, nextStack] of nextStacks.entries()) {
        if (
          isEscapeRoute(nextStack.stackPath.final.frameId, flowchart) &&
          nextStack.stepIds.length === 0
        ) {
          // render disabled escape route mark
          const markPos = add(lastConnectionJoint, [
            sceneW / 2 + scenePadX / 2,
            escapeRouteDropY,
          ]);
          renderEscapeRouteMark(lyr, markPos, undefined, true);
          renderParchmentBox(lyrBelow, ...add(markPos, [-18, 7]), 36, 20, {
            empty: true,
          });
          maxY = Math.max(maxY, markPos[1]);
          continue;
        }

        if (i > 0) curY += scenePadY;

        const isErrorStack = stack.stepIds
          .map((stepId) => traceTree.steps[stepId])
          .every((step) => step.scene.type === "error");
        const isEmptyStack = stack.stepIds.length === 0;

        const child = renderStackAndDownstream(
          lyr,
          lyrAboveViewchart,
          nextStack,
          curX + scenePadX,
          curY,
          viewchart,
        );
        if (isEscapeRoute(nextStack.stackPath.final.frameId, flowchart)) {
          const x = curX + scenePadX + sceneW / 2;
          const y = myY - scenePadY + 10;
          renderEscapeDagger(lyrBelow, [x, y], curY - y);
        }
        for (const v of child.finalPosForConnector) {
          if (!isEmptyStack && !isErrorStack) finalPosForConnectors.push(v);
        }

        // draw connector line
        if (child.initialPosForConnector) {
          const start = [curX, myY + stackH / 2] as Vec2;
          const end = child.initialPosForConnector;

          if (
            !isEmptyStack &&
            !isErrorStack &&
            !isEscapeRoute(nextStack.stackPath.final.frameId, flowchart)
          ) {
            renderConnectorLine(lyrBelow, start, end);
            lastConnectionJoint = add(child.initialPosForConnector, [
              -scenePadX / 2,
              0,
            ]);
          }
        }

        maxX = Math.max(maxX, child.maxX);
        curY = child.maxY;
      }
      maxY = Math.max(maxY, curY);

      // do we need an escape route?
      if (steps.some((step) => step.isStuck) && !frame.escapeRouteFrameId) {
        const markPos = add(lastConnectionJoint, [
          sceneW / 2 + scenePadX / 2,
          escapeRouteDropY - 10,
        ]);
        // render clickable escape route mark
        finalPosForConnectors.push(markPos);
        renderEscapeRouteMark(lyr, markPos, () => {
          if (!frame.escapeRouteFrameId) {
            modifyFlowchart(flowchartId, (old) => addEscapeRoute(old, frameId));
          }
        });

        lyr.save();
        const pos = add(markPos, v(15, 0));
        lyr.translate(...pos);
        lyr.scale(1 + Math.sin(t / 10) * 0.1, 1 + Math.sin(t / 10) * 0.1);
        lyr.translate(...mul(-1, pos));
        renderOutlinedText(lyr, "!?", add(markPos, v(15, 0)), {
          textAlign: "left",
          textBaseline: "middle",
          size: 20,
          color: "#A25848",
        });
        lyr.restore();

        const x = curX + scenePadX + sceneW / 2;
        const y = myY - scenePadY + 10;
        renderEscapeDagger(lyrBelow, [x, y], markPos[1] - y);

        maxY = Math.max(maxY, markPos[1]);
      }

      // debug box
      if (false) {
        lyr.beginPath();
        lyr.rect(myX, myY, maxX - myX, curY - myY);
        lyr.fillStyle = "rgba(255,0,0,0.2)";
        // lyr.lineWidth = 2;
        lyr.fill();
      }

      lyrAbove.place();

      return {
        maxX,
        maxY,
        initialPosForConnector: [
          myX,
          myY + (drewCallHole ? sceneH / 2 : stackH / 2),
        ],
        finalPosForConnector: finalPosForConnectors,
      };
    };
    const stepsInStacks = putStepsInStacks(traceTree);
    const viewchart = stepsInStacksToViewchart(stepsInStacks);
    const lyrAboveViewchart = lyrMain.spawnLater();
    const topLevel = renderViewchart(
      lyrMain,
      lyrAboveViewchart,
      viewchart,
      add(pan, v(100)),
    );
    lyrAboveViewchart.place();
    // is there more than one final stack?
    const finalStacks = Object.values(viewchart.stackByFrameId).filter(
      (stack) => traceTree.finalStepIds.includes(stack.stepIds[0]),
    );
    if (finalStacks.length > 1) {
      const extraX = 100;
      renderConnectorLine(
        lyrMain,
        [topLevel.maxX, pan[1] + sceneW / 2 + 100],
        [topLevel.maxX + extraX, pan[1] + sceneW / 2 + 100],
      );
      renderStack(
        lyrMain,
        lyrAboveViewchart,
        {
          stackPath: {
            callPath: [],
            final: { flowchartId: state.initialFlowchartId, frameId: "FINAL" },
          },
          stepIds: traceTree.finalStepIds,
        },
        topLevel.maxX + extraX,
        pan[1] + 100,
      );
    }

    if (tool.type === "pointer") {
      // handled by css cursor
    } else if (tool.type === "domino") {
      renderDomino(lyrAbove, mouseX, mouseY, tool.orientation, false);
    } else if (tool.type === "call") {
      renderOutlinedText(lyrAbove, tool.flowchartId, [mouseX, mouseY], {
        size: 40,
        color: `hsl(${callHueSaturation} 70%)`,
        family: "monospace",
      });
    } else if (tool.type === "workspace-pick") {
      renderWorkspaceValue(
        lyrAbove,
        undefined,
        [tool.value],
        0,
        undefined,
        add([mouseX, mouseY], v(-cellSize / 2)),
      );
    } else if (tool.type === "purging-flame") {
      renderSpriteSheet(
        lyrAbove,
        imgCandleSheet,
        1,
        127,
        10,
        [100, 100],
        [mouseX - 156, mouseY - 72],
        [300, 300],
      );
    } else if (tool.type === "dev-action") {
      // handled by css cursor
    } else {
      assertNever(tool);
    }

    const flowchartIds = [
      ...Object.values(state.defs.flowcharts).map((f) => f.id),
      zodiacRankedInOrderOfCoolness.find((z) => !state.defs.flowcharts[z])!,
    ];

    // render inventory drawer
    // 300
    const drawerWidth = 320 + 50 * flowchartIds.length;
    renderParchmentBox(
      lyrAbove,
      c.width - drawerWidth,
      c.height - 80,
      drawerWidth + 10,
      110,
      {
        empty: true,
      },
    );

    for (const [i, flowchartId] of flowchartIds.entries()) {
      renderFlowchartSigil(
        lyrAbove,
        flowchartId,
        [c.width - 340 - 50 * (flowchartIds.length - 1 - i), c.height - 60],
        state.defs.flowcharts[flowchartId] !== undefined,
      );
    }

    renderDomino(
      lyrAbove,
      c.width - 270,
      c.height - 20 - (cellSize - dominoPadding * 2),
      "h",
      false,
      {
        onClick: () => {
          tool = { type: "domino", orientation: "h" };
        },
      },
    );
    renderDomino(
      lyrAbove,
      c.width - 220,
      c.height - 20 - (2 * cellSize - dominoPadding * 2),
      "v",
      false,
      {
        onClick: () => {
          tool = { type: "domino", orientation: "v" };
        },
      },
    );

    renderCandle(lyrAbove);

    addClickHandler([c.width - 145, c.height - 160, 90, 130], () => {
      tool = { type: "purging-flame" };
    });

    (window as any).DEBUG = false;

    if (draggedOver) {
      lyrAbove.fillStyle = "rgba(128, 255, 128, 0.5)";
      lyrAbove.fillRect(0, 0, c.width, c.height);
    }

    // mouse position debug
    if (false) {
      lyrAbove.fillStyle = "white";
      lyrAbove.fillRect(mouseX - 100, mouseY, 200, 1);
      lyrAbove.fillRect(mouseX, mouseY - 100, 1, 200);
    }

    // clickables debug
    if (false) {
      lyrAbove.strokeStyle = "rgba(255, 0, 255, 1)";
      lyrAbove.lineWidth = 4;
      for (const clickable of _clickables) {
        lyrAbove.strokeRect(...clickable.xywh);
      }
    }

    const endTime = performance.now();
    if (false) {
      renderOutlinedText(
        lyrAbove,
        `${Math.round(endTime - lastEndTime)}ms`,
        [10, 10],
        {
          textAlign: "left",
          textBaseline: "top",
          size: 20,
        },
      );
    }
    lastEndTime = endTime;

    if (false) {
      console.log("about to draw", getLayerCommandCount(lyrMain));
    }

    lyrAbove.place();
    lyrMain.draw();
  }
});
