import { detect as detectBrowser } from "detect-browser";
import { getArrow } from "perfect-arrows";
import {
  addEscapeRoute,
  appendFrameAfter,
  deleteFrame,
  setAction,
  setActionOnFrameOrAfter,
} from "./edits";
import {
  Action,
  ActionAnnotation,
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
import { drawSpriteSheet, makeCandleRenderer } from "./ui_candle";
import { examples } from "./ui_examples";
import { UIState } from "./ui_state";
import { drawOutlinedText } from "./ui_text";
import {
  XYWH,
  drawArrow,
  expand,
  fillRect,
  fillRectGradient,
  inXYWH,
  loadImg,
  mm,
  saveFile,
} from "./ui_util";
import { assertNever, indexById } from "./util";
import { Vec2, add, angleBetween, distance, mul, v } from "./vec2";

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

let pan: Vec2 = [0, 0];
const setPan = (v: Vec2) => {
  localStorage.setItem("pan", JSON.stringify(v));
  pan = v;
};

const loadExample = (key: keyof typeof examples) => {
  undoStack = [examples[key]];
  redoStack = [];
  syncStacks();
};

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

const hashParams = (() => {
  let hash = window.location.hash;
  if (hash.startsWith("#")) {
    hash = hash.substring(1);
  }

  const [_path, queryString] = hash.split("?", 2);

  // this will remove duplicates, but we don't care
  return Object.fromEntries(new URLSearchParams(queryString).entries());
})();

if (hashParams["example"]) {
  loadExample(hashParams["example"] as keyof typeof examples);
  window.location.replace("#"); // so you won't lose your work when you go back? hmmm
} else {
  const maybeFromLocalStorage = localStorage.getItem("panda-stacks");
  if (maybeFromLocalStorage) {
    ({ undoStack, redoStack } = JSON.parse(maybeFromLocalStorage));
  }

  const maybePanFromLocalStorage = localStorage.getItem("pan");
  if (maybePanFromLocalStorage) {
    pan = JSON.parse(maybePanFromLocalStorage);
  }
}

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

async function main() {
  const [imgParchment, imgAsfault, imgCandleSheet] = await Promise.all([
    loadImg("./parchment.jpg"),
    loadImg("./asfault.jpg"),
    loadImg("./candle_sheet.png"),
  ]);

  const patternParchment = ctxReal.createPattern(imgParchment, "repeat")!;
  const patternAsfault = ctxReal.createPattern(imgAsfault, "repeat")!;

  const backgroundMusic = new Audio("./ambient.mp3");
  backgroundMusic.loop = true;
  let isPlayingBackgroundMusic = false;

  const drawCandle = makeCandleRenderer(imgCandleSheet);

  // don't touch this directly; use addClickHandler
  let _clickables: {
    xywh: XYWH;
    callback: () => void;
  }[] = [];

  const addClickHandler = (xywh: XYWH, callback: () => void) => {
    _clickables.push({ xywh, callback });
  };

  type InteractionState =
    | { type: "not-dragging" }
    // if we're dragging, the drag may be "unconfirmed" – not sure if
    // it's a drag or a click (save the click callback for later)
    | {
        type: "unconfirmed";
        startPos: Vec2;
        callback: (() => void) | undefined;
      }
    | { type: "confirmed"; isPan: boolean; pointerType: string };
  let ix: InteractionState = { type: "not-dragging" } as any;

  type Tool =
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
      };
  let tool: Tool = { type: "pointer" };

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
          loadExample(key as keyof typeof examples);
          return;
        }
      }
      window.alert("Can't find that, sorry.");
    }
    if (e.key === "h") {
      tool = { type: "domino", orientation: "h" };
    }
    if (e.key === "v" && !(e.ctrlKey || e.metaKey)) {
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
    if (e.key === "0" && !(e.ctrlKey || e.metaKey)) {
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
  let pointerType: string;
  let mouseDown = false;
  const updateMouse = (e: PointerEvent) => {
    // clientX/Y works better than offsetX/Y for Chrome/Safari compatibility.
    const dragOffset =
      ix.type === "confirmed" && pointerType === "touch" ? 50 : 0;
    mouseX = e.clientX;
    mouseY = e.clientY - dragOffset;
    pointerType = e.pointerType;
  };
  const hoveredClickable = () => {
    return _clickables.find(({ xywh }) => inXYWH(mouseX, mouseY, xywh));
  };

  c.addEventListener("pointermove", (e) => {
    updateMouse(e);

    if (ix.type === "unconfirmed") {
      if (distance(ix.startPos, [e.clientX, e.clientY]) > 4) {
        if (ix.callback) {
          ix.callback();
          ix = { type: "confirmed", isPan: false, pointerType };
        } else {
          e;
          ix = { type: "confirmed", isPan: true, pointerType };
        }
      }
    }

    if (shiftHeld || (ix.type === "confirmed" && ix.isPan)) {
      setPan(add(pan, [e.movementX, e.movementY]));
    }
  });
  c.addEventListener("pointerdown", (e) => {
    updateMouse(e);
    mouseDown = true;

    const callback = hoveredClickable()?.callback;
    ix = { type: "unconfirmed", startPos: [mouseX, mouseY], callback };
  });
  c.addEventListener("pointerup", (e) => {
    updateMouse(e);
    mouseDown = false;

    if (ix.type === "unconfirmed") {
      // a click!
      if (ix.callback) {
        ix.callback();
      } else {
        tool = { type: "pointer" };
      }
    } else if (ix.type === "confirmed") {
      if (!ix.isPan) {
        // a drag!
        const callback = hoveredClickable()?.callback;
        if (callback) {
          callback();
        } else {
          tool = { type: "pointer" };
        }
      } else {
        // end of a pan; it's all good
      }
    } else if (ix.type === "not-dragging") {
      // impossible! whatever
    } else {
      assertNever(ix);
    }
    ix = { type: "not-dragging" };
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

  const drawParchmentBox = (
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

  const drawDomino = (
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

  const drawDominoes = (
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

      drawDomino(
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

  const drawWorkspace = (
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
    let annotation:
      | (ActionAnnotation & { type: "workspace-pick" })
      | undefined = undefined;
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
      drawDropTargetLine(
        lyrTop,
        pos[0] + 10,
        curY - 5,
        pos[0] + sceneW - 20,
        curY - 5,
        { type: "after", index: -1 },
      );
    }

    let removalXYWH: XYWH | undefined = undefined;
    let insertionXYWH: XYWH | undefined = undefined;

    for (let [idxInWorkspace, item] of contents.entries()) {
      if (idxInWorkspace > 0) {
        curY += 5;
      }
      const result = drawWorkspaceValue(
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
      curY = result.maxY;

      if (result.removalXYWH) {
        removalXYWH = result.removalXYWH;
      }
      if (result.insertionXYWH) {
        insertionXYWH = result.insertionXYWH;
      }

      if (isDropTarget) {
        curY += 5;
        drawDropTargetLine(
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

    if (insertionXYWH && removalXYWH) {
      const removalPt = mm(removalXYWH);
      const insertionPt = mm(insertionXYWH);
      const dist = distance(removalPt, insertionPt);
      const angle = angleBetween(removalPt, insertionPt);

      function getSector(a: number, s = 8) {
        return Math.floor(s * (0.5 + ((a / (Math.PI * 2)) % s)));
      }

      const sceneCenter = add(pos, [sceneW / 2, sceneH / 2]);
      const angleAroundCenter =
        ((angleBetween(removalPt, sceneCenter) -
          angleBetween(insertionPt, sceneCenter) +
          Math.PI) %
          (Math.PI * 2)) -
        Math.PI;

      // const arrow = getBoxToBoxArrow(...removalXYWH, ...insertionXYWH, {
      const arrow = getArrow(...mm(removalXYWH), ...mm(insertionXYWH), {
        bow: 0.1,
        stretch: 1,
        stretchMin: 0,
        stretchMax: 50,
        padStart: 3,
        padEnd: 8,
        flip: (getSector(angle) % 2 === 0) !== angleAroundCenter > 0,
        straights: false,
      });

      lyrTop.do((lyr) => {
        lyr.lineWidth = 2;
        lyr.strokeStyle = "#fce8a7cc";
        lyr.fillStyle = "#fce8a7cc";
        lyr.shadowColor = "rgba(0,0,0,0.6)";
        lyr.shadowOffsetY = 2;
        lyr.shadowBlur = 10;

        lyr.beginPath();
        lyr.arc(...removalPt, 3, 0, Math.PI * 2);
        lyr.fill();

        drawArrow(lyr, arrow, {
          headLength: Math.min(12, dist / 4),
          headWidth: 8,
        });
      });
    }

    lyrTop.place();
  };

  const drawWorkspaceValue = (
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
  ): {
    maxY: number;
    removalXYWH: XYWH | undefined;
    insertionXYWH: XYWH | undefined;
  } => {
    const { removalIdx, insertionIdx, isBad, interactable = true } = opt;

    let removalXYWH: XYWH | undefined = undefined;
    let insertionXYWH: XYWH | undefined = undefined;

    const isDropTarget =
      interactable &&
      path &&
      tool.type === "workspace-pick" &&
      stackPathToString(tool.stackPath) === stackPathToString(path);

    let left = pos[0];

    if (isDropTarget && lyrTop) {
      drawDropTargetLine(
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
      | { type: "item"; value: unknown; isAdded: boolean; idx: number }
      | { type: "removal" }
    )[] = value.map((item: unknown, idx: number) => ({
      type: "item",
      value: item,
      isAdded: insertionIdx === idx,
      idx,
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

      const cellPos = [left, pos[1] + cellSize * 0] as const;
      const xywh = [...cellPos, cellSize, cellSize] as const;

      if (isInsertion) {
        insertionXYWH = xywh;
      }
      if (isRemoval) {
        removalXYWH = xywh;
      }

      (isRemoval ? lyrRemoval : lyr).do((lyr) => {
        // the box
        if (isInsertion) {
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
                index: cell.idx,
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
          lyr.fillStyle = ["♦", "♥"].includes(cell.value as string)
            ? "rgba(200,0,0,0.8)"
            : "rgba(0,0,0,0.8)";
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
          cell.type === "item" &&
          tool.index === cell.idx
        ) {
          lyr.fillStyle = "rgba(200,200,200,1)";
          lyr.fillRect(...xywh);
        }
      });

      left += cellSize;
    }
    if (cellContents.length === 0) {
      const cellPos = [left, pos[1] + cellSize * 0] as const;
      const xywh = [...cellPos, cellSize, cellSize] as const;

      lyr.beginPath();
      lyr.lineWidth = 3;
      lyr.strokeStyle = isBad ? `rgba(128,0,0,0.5)` : "#70665a";
      lyr.setLineDash([4, 4]);
      lyr.rect(...xywh);
      lyr.stroke();
      lyr.setLineDash([]);

      left += cellSize;
    }
    if (isDropTarget && lyrTop) {
      // replacement line
      drawDropTargetLine(
        lyrTop,
        pos[0] + cellSize / 4,
        pos[1] + cellSize / 2,
        left - cellSize / 4,
        pos[1] + cellSize / 2,
        {
          type: "at",
          index: idxInWorkspace,
          side: "replace",
        },
      );
    }
    left += 5;

    if (isDropTarget) {
      drawDropTargetLine(lyr, left, pos[1], left, pos[1] + cellSize, {
        type: "at",
        index: idxInWorkspace,
        side: "after",
      });
    }

    lyrRemoval.place();

    return { maxY: pos[1] + cellSize, removalXYWH, insertionXYWH };
  };

  const drawDropTargetLine = (
    lyr: Layer,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    target: (Action & { type: "workspace-pick" })["target"],
  ) => {
    const lineXYWH = [x1, y1, x2 - x1, y2 - y1] as const;
    const mouseXYWH = expand(lineXYWH, 5);

    lyr.save();
    lyr.strokeStyle = inXYWH(mouseX, mouseY, mouseXYWH)
      ? "rgba(255,200,0,0.8)"
      : "#70665a";
    lyr.lineWidth = 3;
    lyr.setLineDash([2, 2]);
    lyr.beginPath();
    lyr.moveTo(x1, y1);
    lyr.lineTo(x2, y2);
    lyr.stroke();
    lyr.restore();

    addClickHandler(mouseXYWH, () => {
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

  const drawSceneValue = (
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
      drawDominoes(
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
      // TODO: drawSceneValue is a big mess
      drawWorkspace(
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
      drawOutlinedText(
        lyr,
        JSON.stringify(value, null, 2) ?? "idk",
        [topLeft[0] + 10, topLeft[1] + 10],
        { textAlign: "left", textBaseline: "top" },
      );
    }

    lyr.restore();
  };

  const drawScene = (
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
      // lyr.shadowColor = "white";
      // lyr.shadowBlur = 10;
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
    drawParchmentBox(lyr, ...xywh);
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
          drawWorkspace(
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
          drawSceneValue(
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

      drawOutlinedText(
        lyr,
        step.scene.message,
        [topleft[0] + sceneW, topleft[1] + sceneH],
        { textAlign: "right", color: "#e8816b" },
      );
      return;
    }
    assertSuccessful(step);

    drawSceneValue(lyr, step, step.scene.value, frame, defs, topleft);

    if (tool.type === "purging-flame" && frame.action?.type !== "start") {
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

  let lastEndTime = performance.now();

  requestAnimationFrame(drawLoopProtected);

  let t = 0;
  function drawLoopProtected() {
    requestAnimationFrame(drawLoopProtected);
    try {
      drawLoop();
    } catch (e) {
      throw e;
      // pushState(examples.dominoesBlank);
    }
  }
  function drawLoop() {
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

    const [cursorName, cursorStyle] =
      shiftHeld || (ix.type === "confirmed" && ix.isPan)
        ? ["glove1", "url('./glove1.png') 7 3, pointer"]
        : tool.type === "pointer"
          ? mouseDown
            ? ["glove2", "url('./glove2.png') 7 3, pointer"]
            : ["glove3", "url('./glove3.png') 7 3, pointer"]
          : tool.type === "dev-action"
            ? ["help", "help"]
            : ["none", "none"];
    c.style.cursor = cursorStyle;

    // draw background
    ctxReal.fillStyle = patternAsfault;
    patternAsfault.setTransform(new DOMMatrix().translate(...pan, 0));
    ctxReal.fillRect(0, 0, c.width, c.height);
    ctxReal.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctxReal.fillRect(0, 0, c.width, c.height);

    const drawConnectorLine = (
      lyr: Layer,
      start: Vec2,
      end: Vec2,
      opts: { dead?: boolean } = {},
    ) => {
      const { dead = false } = opts;

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
      lyr.lineWidth = dead ? 2 : 5;
      //// or maybe we want dashed lines?
      // if (dead) {
      //   lyr.setLineDash([4, 2]);
      // }
      lyr.stroke();
      lyr.restore();
    };

    const drawFlowchartSigil = (
      lyr: Layer,
      flowchartId: string,
      pos: Vec2,
      exists: boolean = true,
    ) => {
      drawOutlinedText(lyr, flowchartId, pos, {
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

    // draw trace
    const scenePadX = 20;
    const scenePadY = 40;
    const callPad = 20;
    const callTopPad = 20;

    const drawViewchart = (
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

      drawFlowchartSigil(
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
      const r = drawStackAndDownstream(
        lyr,
        lyrAboveViewchart,
        initialStack,
        ...topLeft,
        viewchart,
      );

      // final connector lines, out of viewchart
      for (const v of r.finalPosForConnectors) {
        drawConnectorLine(lyrBelow, v.pos, [r.maxX, topLeft[1] + sceneH / 2], {
          dead: v.dead,
        });
      }

      // initial little connector line on the left
      const start = add(topLeft, v(-scenePadX, sceneH / 2));
      const end = add(start, v(scenePadX, 0));
      drawConnectorLine(lyrBelow, start, end);

      lyrAbove.place();

      return r;
    };

    const drawInset = (
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

    const drawEscapeRouteMark = (
      lyr: Layer,
      centerPos: Vec2,
      onClick?: () => void,
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
    const drawEscapeDagger = (lyr: Layer, topPos: Vec2, height: number) => {
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
    const escapeRouteDropY = sceneH - 10;

    const drawStack = (
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
        (inXYWH(mouseX, mouseY, [curX, myY, sceneW, sceneH]) ||
          hoveredStackPathString === stackPathString) &&
        myY < c.height - sceneH; // weird stuff happens (inc. crash) if we hover a stack too close to bottom

      if (hovered) {
        hoveredStackPathString = undefined;
      }

      const stackH = 35;
      const layerToUse = hovered ? lyrAboveViewchart : lyr;
      layerToUse.do((lyr) => {
        for (const [stepIdx, step] of steps.entries()) {
          let targetX = curX;
          let targetY = myY + (stepIdx / stack.stepIds.length) * stackH;
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
          drawScene(lyr, step, xy, () => {
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
          // draw number of steps in stack
          drawOutlinedText(
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
          drawParchmentBox(lyr, curX, myY, w, h, {
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
    const drawStackAndDownstream = (
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
      finalPosForConnectors: { pos: Vec2; dead: boolean }[];
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

      // draw call, if any
      // curX is lhs of call hole
      let drewCallHole = false;
      if (frame.action?.type === "call") {
        const childViewchart = viewchart.callViewchartsByFrameId[frameId] as
          | Viewchart
          | undefined;
        if (childViewchart) {
          const child = drawViewchart(
            lyrAbove,
            lyrAboveViewchart,
            childViewchart,
            [curX + callPad, curY + callPad + callTopPad],
          );
          maxY = Math.max(maxY, child.maxY + callPad);

          drawInset(
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

      // draw stack
      // curX is now lhs of stack
      const stackPathString = stackPathToString(stack.stackPath);
      // TODO: returning layerUsed feels bad to me
      const drawStackResult = drawStack(
        lyr,
        lyrAboveViewchart,
        stack,
        curX,
        myY,
      );
      const stackH = drawStackResult.maxY - myY;
      if (drewCallHole) {
        drawConnectorLine(
          lyr,
          [curX - scenePadX, curY + stackH / 2],
          [curX, curY + stackH / 2],
        );
      }
      maxY = Math.max(maxY, drawStackResult.maxY);
      let label = getActionText(flowchart.frames[frameId].action);
      if (label.startsWith("call")) {
        // special case to make call sigil look good for Elliot's browser font rendering
        drawOutlinedText(drawStackResult.layerUsed, "call", [curX, myY], {
          textAlign: "left",
        });
        drawOutlinedText(
          drawStackResult.layerUsed,
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
        drawOutlinedText(drawStackResult.layerUsed, label, [curX, myY], {
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
        // draw escape route mark on-top of escape route frame
        drawEscapeRouteMark(drawStackResult.layerUsed, [myX + sceneW / 2, myY]);
      }
      curX = drawStackResult.maxX;

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

      const hasSuccess = stack.stepIds
        .map((stepId) => traceTree.steps[stepId])
        .some((step) => step.scene.type === "success");

      // draw downstream
      let maxX = curX + scenePadX;
      const nextStacks = getNextStacksInLevel(stack, stepsInStacks, defs);
      const finalPosForConnectors: { pos: Vec2; dead: boolean }[] = [];
      // hacky thing to position unused escape routes or escape-route ghosts
      let lastConnectionJoint: Vec2 = [curX + scenePadX / 2, myY + sceneH / 2];
      if (nextStacks.length === 0) {
        finalPosForConnectors.push({
          pos: [curX, myY + stackH / 2],
          dead: !hasSuccess,
        });
      }
      for (const [i, nextStack] of nextStacks.entries()) {
        if (
          isEscapeRoute(nextStack.stackPath.final.frameId, flowchart) &&
          nextStack.stepIds.length === 0
        ) {
          // draw unused escape route mark
          const markPos = add(lastConnectionJoint, [
            sceneW / 2 + scenePadX / 2,
            escapeRouteDropY,
          ]);
          drawEscapeRouteMark(lyr, markPos, undefined, true);
          const w = 60;
          const h = 50;
          const xywh = [...add(markPos, [-w / 2, 7]), w, h] as const;
          drawParchmentBox(lyrBelow, ...xywh, {
            empty: true,
          });
          if (tool.type === "purging-flame") {
            const { flowchartId, frameId } = nextStack.stackPath.final;
            addClickHandler(xywh, () => {
              modifyFlowchart(flowchartId, (old) => deleteFrame(old, frameId));
              tool = { type: "pointer" };
            });
          }
          maxY = Math.max(maxY, markPos[1] + h - 10);
          continue;
        }

        if (i > 0) curY += scenePadY;

        const child = drawStackAndDownstream(
          lyr,
          lyrAboveViewchart,
          nextStack,
          curX + scenePadX,
          curY,
          viewchart,
        );
        for (const v of child.finalPosForConnectors) {
          finalPosForConnectors.push(v);
        }
        if (isEscapeRoute(nextStack.stackPath.final.frameId, flowchart)) {
          const x = curX + scenePadX + sceneW / 2;
          const y = myY - scenePadY + 10;
          drawEscapeDagger(lyrBelow, [x, y], curY - y);
        }

        // draw connector line
        if (child.initialPosForConnector) {
          const start = [curX, myY + stackH / 2] as Vec2;
          const end = child.initialPosForConnector;

          if (!isEscapeRoute(nextStack.stackPath.final.frameId, flowchart)) {
            drawConnectorLine(lyrBelow, start, end, { dead: !hasSuccess });
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
          escapeRouteDropY,
        ]);
        // draw clickable escape route mark
        drawEscapeRouteMark(lyr, markPos, () => {
          if (!frame.escapeRouteFrameId) {
            modifyFlowchart(flowchartId, (old) => addEscapeRoute(old, frameId));
          }
        });
        finalPosForConnectors.push({ pos: markPos, dead: !hasSuccess });

        lyr.save();
        const pos = add(markPos, v(15, 0));
        lyr.translate(...pos);
        lyr.scale(1 + Math.sin(t / 10) * 0.1, 1 + Math.sin(t / 10) * 0.1);
        lyr.translate(...mul(-1, pos));
        drawOutlinedText(lyr, "!?", add(markPos, v(15, 0)), {
          textAlign: "left",
          textBaseline: "middle",
          size: 20,
          color: "#A25848",
        });
        lyr.restore();

        const x = curX + scenePadX + sceneW / 2;
        const y = myY - scenePadY + 10;
        drawEscapeDagger(lyrBelow, [x, y], markPos[1] - y);

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
        finalPosForConnectors,
      };
    };
    const stepsInStacks = putStepsInStacks(traceTree);
    const viewchart = stepsInStacksToViewchart(stepsInStacks);
    const lyrAboveViewchart = lyrMain.spawnLater();
    const topLevel = drawViewchart(
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
      drawConnectorLine(
        lyrMain,
        [topLevel.maxX, pan[1] + sceneW / 2 + 100],
        [topLevel.maxX + extraX, pan[1] + sceneW / 2 + 100],
      );
      drawStack(
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

    const flowchartIds = [
      ...Object.values(state.defs.flowcharts).map((f) => f.id),
      zodiacRankedInOrderOfCoolness.find((z) => !state.defs.flowcharts[z])!,
    ];

    // draw inventory drawer
    // 300
    const drawerWidth = 320 + 50 * flowchartIds.length;
    drawParchmentBox(
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
      drawFlowchartSigil(
        lyrAbove,
        flowchartId,
        [c.width - 340 - 50 * (flowchartIds.length - 1 - i), c.height - 60],
        state.defs.flowcharts[flowchartId] !== undefined,
      );
    }

    drawDomino(
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
    drawDomino(
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

    drawCandle(lyrAbove);

    addClickHandler([c.width - 145, c.height - 160, 90, 130], () => {
      tool = { type: "purging-flame" };
    });

    // the ear
    lyrAbove.do(() => {
      lyrAbove.fillStyle = isPlayingBackgroundMusic
        ? "rgba(0, 0, 0, 1)"
        : "rgba(0, 0, 0, 0.5)";
      lyrAbove.textAlign = "right";
      lyrAbove.textBaseline = "bottom";
      lyrAbove.font = "35px serif";
      lyrAbove.fillText("𓂈", c.width - 9, c.height - 35);
    });
    addClickHandler([c.width - 38, c.height - 69, 38, 30], async () => {
      if (!isPlayingBackgroundMusic) {
        try {
          // On the first user interaction, try playing the audio
          await backgroundMusic.play();
          isPlayingBackgroundMusic = true;
        } catch (error) {
          console.error("Failed to start audio playback:", error);
          isPlayingBackgroundMusic = false;
        }
      } else {
        // If it was already playing, just pause it
        backgroundMusic.pause();
        isPlayingBackgroundMusic = false;
      }
    });

    // the eye
    lyrAbove.do(() => {
      lyrAbove.fillStyle = "rgba(0, 0, 0, 1)";
      lyrAbove.textAlign = "right";
      lyrAbove.textBaseline = "bottom";
      lyrAbove.font = "20px serif";
      lyrAbove.fillText("𓂀", c.width - 8, c.height - 8);
    });
    addClickHandler([c.width - 38, c.height - 33, 38, 30], () => {
      window.location.href = "./credits.html";
    });

    (window as any).DEBUG = false;

    if (tool.type === "pointer") {
      // handled by css cursor
    } else if (tool.type === "domino") {
      drawDomino(lyrAbove, mouseX, mouseY, tool.orientation, false);
    } else if (tool.type === "call") {
      drawOutlinedText(lyrAbove, tool.flowchartId, [mouseX, mouseY], {
        size: 40,
        color: `hsl(${callHueSaturation} 70%)`,
        family: "monospace",
      });
    } else if (tool.type === "workspace-pick") {
      drawWorkspaceValue(
        lyrAbove,
        undefined,
        [tool.value],
        0,
        undefined,
        add([mouseX, mouseY], v(-cellSize / 2)),
      );
    } else if (tool.type === "purging-flame") {
      drawSpriteSheet(
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

    if (tool.type === "pointer") {
      // handled by css cursor
    } else if (tool.type === "domino") {
      drawDomino(lyrAbove, mouseX, mouseY, tool.orientation, false);
    } else if (tool.type === "call") {
      drawOutlinedText(lyrAbove, tool.flowchartId, [mouseX, mouseY], {
        size: 40,
        color: `hsl(${callHueSaturation} 70%)`,
        family: "monospace",
      });
    } else if (tool.type === "workspace-pick") {
      drawWorkspaceValue(
        lyrAbove,
        undefined,
        [tool.value],
        0,
        undefined,
        add([mouseX, mouseY], v(-cellSize / 2)),
      );
    } else if (tool.type === "purging-flame") {
      drawSpriteSheet(
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

    if (tool.type === "pointer") {
      // handled by css cursor
    } else if (tool.type === "domino") {
      drawDomino(lyrAbove, mouseX, mouseY, tool.orientation, false);
    } else if (tool.type === "call") {
      drawOutlinedText(lyrAbove, tool.flowchartId, [mouseX, mouseY], {
        size: 40,
        color: `hsl(${callHueSaturation} 70%)`,
        family: "monospace",
      });
    } else if (tool.type === "workspace-pick") {
      drawWorkspaceValue(
        lyrAbove,
        undefined,
        [tool.value],
        0,
        undefined,
        add([mouseX, mouseY], v(-cellSize / 2)),
      );
    } else if (tool.type === "purging-flame") {
      drawSpriteSheet(
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

    // ix state debug
    if (false) {
      lyrAbove.do(() => {
        lyrAbove.strokeStyle = "rgba(255, 0, 255, 1)";
        lyrAbove.lineWidth = 4;
        lyrAbove.fillStyle = "rgba(255, 0, 255, 1)";
        lyrAbove.fillText(JSON.stringify(ix), 20, 20);
      });
    }

    const endTime = performance.now();
    if (false) {
      drawOutlinedText(
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
}

main();
