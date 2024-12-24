// STATIC WORLD

import { assertNever, indexById, log, truthy } from "./util";
import { Vec2 } from "./vec2";

export type Flowchart = {
  id: string;
  initialFrameId: string;
  frames: { [id: string]: Frame };
  arrows: { from: string; to: string }[];
};

export type Frame = {
  id: string;
  action?: Action;
  escapeRouteFrameId?: string;
};

export type Action =
  | {
      type: "start";
    }
  | {
      type: "escape";
    }
  | {
      // this one won't be used in the real deal; we'll want to have
      // better ways than opaque functions to specify & show actions
      type: "test-func";
      label?: string;
      func: (input: Scene & { type: "success" }) => Scene[];
    }
  | {
      type: "place-domino";
      domino: [Vec2, Vec2];
    }
  | {
      type: "call";
      flowchartId: string;
      lens?: Lens;
    }
  | {
      // another fake one
      type: "test-cond";
      func: (input: Scene & { type: "success" }) => boolean;
      then: Action | undefined;
      else: Action | undefined;
    }
  | {
      type: "workspace-pick";
      source: number; // index in the workspace
      index: number | "first" | "last" | "any";
      target:
        | { type: "at"; index: number; side: "before" | "after" | "replace" }
        | { type: "after"; index: number };
    }
  | {
      type: "add-triangle-edge";
      edge: "ab" | "bc" | "ac";
    }
  | {
      type: "dev-eval";
      code: string;
    };

export type ActionAnnotation = {
  type: "workspace-pick";
  src: [number, number];
  dst: [number, number];
};

export type ErrorAnnotation =
  | { type: "scene"; scene: Scene & { type: "success" } }
  | {
      type: "workspace-pick-bad-source";
      scene: Scene & { type: "success" };
      source: number;
    };

export class ErrorWithAnnotation extends Error {
  constructor(
    message: string,
    public annotation: ErrorAnnotation,
  ) {
    super(message);
  }
}

export type Lens =
  | {
      type: "domino-grid";
      dx: number;
      dy: number;
    }
  | {
      type: "sierpinski-child";
      child: "a" | "b" | "c";
      rot: 0 | 1 | 2;
    };

/**
 * If we're going to call one flowchart from another, we need to know
 * what flowcharts are out there.
 */
export type Definitions = {
  flowcharts: Record<string, Flowchart>;
};

// IMPLEMENTATION WORLD

export type LensImpl = {
  // TODO: using "value" here rather than "scene" for convenience; if
  // a scene is ever more than just a value we'll have to figure this
  // out
  getPart(lens: Lens, value: any): any;
  setPart(lens: Lens, value: any, part: any): any;
};

// DYNAMIC WORLD

/**
 * When you run a flowchart, you get a TraceTree. It tells you
 * everywhere the execution goes. Because of ambs, this won't always
 * be a linear chain of steps! Sometimes a step might lead to
 * multiple next steps. But I guess it's always a tree? Hence the
 * name.
 *
 * Note that a trace tree extends into function calls! Wow.
 */
export type TraceTree = {
  steps: { [id: string]: Step };
  finalStepIds: string[];
};

/**
 * A (completed) step in the execution of a flowchart. It's
 * /concrete/ – no ambing or suchlike. A specific scene! But it
 * happens somewhere (a frame, maybe in some nested calls) and it
 * (probably) came from somewhere (a previous step).
 */
export type Step = {
  id: string;
  prevStepId: string | undefined;
  frameId: string;
  flowchartId: string;
  scene: Scene;
  caller: Call | undefined;
  isStuck?: boolean;
};

export type Call = {
  // We need to know:
  // 1. The input to the call
  prevStepId: string;
  // 2. The call that was made
  frameId: string;
};

/**
 * A scene is the state of the world inside a frame. For now we just
 * represent it as an arbitrary value; who knows what might come
 * later.
 */
export type Scene =
  | {
      type: "success";
      value: any;
      // This is metadata provided by the action that produced this
      // scene, providing information to help illustrate the action.
      actionAnnotation?: ActionAnnotation;
    }
  | {
      type: "error";
      message: string;
      errorAnnotation?: ErrorAnnotation;
    };

export type SuccessfulStep = Step & { scene: { type: "success" } };

// FUNCTIONS

export function assertSuccessful(step: Step): asserts step is SuccessfulStep {
  if (step.scene.type === "error") {
    throw new Error("INTERNAL ERROR: you promised this step was successful :(");
  }
}

export function assertSuccessfulValue(step: Step): SuccessfulStep {
  assertSuccessful(step);
  return step;
}

export function makeTraceTree(): TraceTree {
  return {
    steps: {},
    finalStepIds: [],
  };
}

let RUN_ALL_DEPTH = 0;

/**
 * Given step running in a flowchart, runs the flowchart to
 * completion (in all possible ways) and puts the results into the
 * mutable traceTreeOut.
 */
export function runAll(
  step: Step & { scene: { type: "success" } },
  defs: Definitions,
  traceTreeOut: TraceTree,
  callDepth: number,
): void {
  if (RUN_ALL_DEPTH > 100) {
    throw new RangeError("runAll depth overflow");
  }

  RUN_ALL_DEPTH++;
  try {
    // console.log(step.id);
    // log(step.scene.value);
    // console.log();

    // this is our responsibility I guess
    traceTreeOut.steps[step.id] = step;

    const { flowchartId, frameId, scene, caller } = step;
    const flowchart = defs.flowcharts[flowchartId];
    const frame = flowchart.frames[frameId];
    const nextArrows = flowchart.arrows.filter(({ from }) => from === frameId);

    // If there are no further arrows, we assume the current flowchart
    // is done (and return to the caller if necessary).
    //
    // TODO: Any need to be more explicit about returning? Design
    // decision!
    const isFinalFrame = nextArrows.length === 0;
    if (isFinalFrame) {
      if (caller === undefined) {
        traceTreeOut.finalStepIds.push(step.id);
        // console.log("  *********");
        // console.log("  * FINAL *");
        // console.log("  *********");
        // console.log("");
        return;
      }

      const callerInfo = getCallerInfo(caller, traceTreeOut, defs);

      let returnScene: Scene = { ...scene, actionAnnotation: undefined };
      const callerLens = callerInfo.frame.action.lens;
      if (callerLens) {
        const lensImpl = lenses[callerLens.type];
        if (!lensImpl) {
          throw new Error(`Lens type ${callerLens.type} not found`);
        }
        returnScene = {
          ...scene,
          value: lensImpl.setPart(
            callerLens,
            assertSuccessfulValue(callerInfo.prevStep).scene.value,
            scene.value,
          ),
        };
      }

      const nextStep: SuccessfulStep = {
        id: `${step.id}↑${callerInfo.flowchart.id}→${caller.frameId}`,
        prevStepId: step.id,
        flowchartId: callerInfo.flowchart.id,
        frameId: caller.frameId,
        scene: returnScene,
        caller: callerInfo.prevStep.caller,
      };
      runAll(nextStep, defs, traceTreeOut, callDepth - 1);
      return;
    }

    // Otherwise, we follow all arrows.
    let continuedSuccessfully = false;
    for (const nextArrow of nextArrows) {
      const nextFrameId = nextArrow.to;
      const nextFrame = flowchart.frames[nextFrameId];
      if (!nextFrame) {
        throw new Error(`Frame ${nextFrameId} not found`);
      }
      try {
        performAction(
          step,
          nextFrameId,
          nextFrame.action,
          defs,
          traceTreeOut,
          callDepth,
        );
        continuedSuccessfully = true;
      } catch (e) {
        // TODO: not sure this is the right place to output this...
        let scene: Scene = { type: "error", message: "unknown" };
        if (e instanceof ErrorWithAnnotation) {
          scene = {
            type: "error",
            message: e.message,
            errorAnnotation: e.annotation,
          };
        } else if (e instanceof Error) {
          scene = { type: "error", message: e.message };
        }
        const nextStep: Step = {
          id: `${step.id}→${nextFrameId}`,
          prevStepId: step.id,
          flowchartId,
          frameId: nextFrameId,
          scene,
          caller,
        };
        traceTreeOut.steps[nextStep.id] = nextStep;
      }
    }
    if (!continuedSuccessfully) {
      // TODO: first time we've mutated a step after adding it? idk
      step.isStuck = true;
      if (frame.escapeRouteFrameId) {
        performAction(
          step,
          frame.escapeRouteFrameId,
          flowchart.frames[frame.escapeRouteFrameId].action,
          defs,
          traceTreeOut,
          callDepth,
        );
      }
    }
  } finally {
    RUN_ALL_DEPTH--;
  }
}

function performAction(
  step: SuccessfulStep,
  frameId: string,
  action: Action | undefined,
  defs: Definitions,
  traceTreeOut: TraceTree,
  callDepth: number,
): void {
  const { flowchartId, scene, caller } = step;

  function proceedWith(nextScenes: Scene[]) {
    if (nextScenes.length === 0) {
      // TODO: we currently regard an empty proceedWith as a failure,
      // so that, e.g., you can provide an escape route if "move any
      // item" is called on an empty list. this is all weird and
      // hacky and deserves more thought.
      throw new ErrorWithAnnotation("no way to go", { type: "scene", scene });
    }
    let i = 0;
    for (const nextScene of nextScenes) {
      const nextStep: Step = {
        id: `${step.id}→${frameId}${nextScenes.length > 1 ? `[${i++}]` : ""}`,
        prevStepId: step.id,
        flowchartId,
        frameId,
        scene: nextScene,
        caller,
      };
      if (nextScene.type === "success") {
        runAll(assertSuccessfulValue(nextStep), defs, traceTreeOut, callDepth);
      }
    }
  }

  if (!action || action.type === "start" || action.type === "escape") {
    proceedWith([{ ...scene, actionAnnotation: undefined }]);
  } else if (action.type === "test-func") {
    proceedWith(action.func(scene));
  } else if (action.type === "place-domino") {
    const { domino } = action;
    const { value } = scene;
    const newScene: Scene = {
      type: "success",
      value: {
        ...value,
        dominoes: [...value.dominoes, action.domino],
      },
    };
    if (
      domino[0][0] < 0 ||
      domino[0][1] < 0 ||
      domino[1][0] < 0 ||
      domino[1][1] < 0 ||
      domino[0][0] >= value.width ||
      domino[0][1] >= value.height ||
      domino[1][0] >= value.width ||
      domino[1][1] >= value.height
    ) {
      throw new ErrorWithAnnotation("off the board", {
        type: "scene",
        scene: newScene,
      });
    }
    proceedWith([newScene]);
  } else if (action.type === "call") {
    // console.log("callDepth", callDepth);
    if (callDepth > 10) {
      throw new Error("too deep");
    }

    // time to step into the call
    const nextFlowchart = defs.flowcharts[action.flowchartId];
    if (!nextFlowchart) {
      throw new Error(`Flowchart ${action.flowchartId} not found`);
    }
    let callScene = {
      ...scene,
      actionAnnotation: undefined,
    };
    if (action.lens) {
      const lensImpl = lenses[action.lens.type];
      if (!lensImpl) {
        throw new Error(`Lens type ${action.lens.type} not found`);
      }
      callScene = {
        ...scene,
        value: lensImpl.getPart(action.lens, scene.value),
        actionAnnotation: undefined,
      };
    }
    const nextStep: SuccessfulStep = {
      id: `${step.id}→${frameId}↓${nextFlowchart.id}`,
      prevStepId: step.id,
      flowchartId: action.flowchartId,
      frameId: nextFlowchart.initialFrameId,
      scene: callScene,
      caller: {
        prevStepId: step.id,
        frameId,
      },
    };
    runAll(nextStep, defs, traceTreeOut, callDepth + 1);
  } else if (action.type === "test-cond") {
    const nextAction = action.func(scene) ? action.then : action.else;
    performAction(step, frameId, nextAction, defs, traceTreeOut, callDepth);
  } else if (action.type === "workspace-pick") {
    const { source, index, target } = action;
    const { value } = scene;
    const sourceValue: unknown[] = value.contents[source];
    if (!sourceValue) {
      throw new Error(`Item ${source} not found in workspace`);
    }
    let pickedIndices: number[];
    if (index === "first") {
      pickedIndices = [0];
    } else if (index === "last") {
      pickedIndices = [sourceValue.length - 1];
    } else if (index === "any") {
      pickedIndices = Array.from({ length: sourceValue.length }, (_, i) => i);
    } else {
      pickedIndices = [index];
    }
    const nextScenes = pickedIndices.map((pickedIndex) => {
      if (pickedIndex < 0 || pickedIndex >= sourceValue.length) {
        if (sourceValue.length === 0) {
          throw new ErrorWithAnnotation(`list is empty`, {
            type: "workspace-pick-bad-source",
            scene: { type: "success", value },
            source,
          });
        } else {
          throw new Error(`off the list`);
        }
      }
      let annotation: ActionAnnotation | undefined = undefined;
      let newWorkspace = value.contents.slice();
      const pickedItem = sourceValue[pickedIndex];
      newWorkspace[source] = sourceValue.slice();
      newWorkspace[source].splice(pickedIndex, 1);
      if (target.type === "at") {
        if (target.side === "replace") {
          newWorkspace[target.index] = [pickedItem];
          annotation = {
            type: "workspace-pick",
            src: [source, pickedIndex],
            dst: [target.index, 0],
          };
        } else if (target.side === "before") {
          newWorkspace[target.index] = [
            pickedItem,
            ...newWorkspace[target.index],
          ];
          annotation = {
            type: "workspace-pick",
            src: [source, pickedIndex],
            dst: [target.index, 0],
          };
        } else if (target.side === "after") {
          newWorkspace[target.index] = [
            ...newWorkspace[target.index],
            pickedItem,
          ];
          annotation = {
            type: "workspace-pick",
            src: [source, pickedIndex],
            dst: [target.index, newWorkspace[target.index].length - 1],
          };
        } else {
          assertNever(target.side);
        }
      } else if (target.type === "after") {
        newWorkspace.splice(target.index + 1, 0, [pickedItem]);
        annotation = {
          type: "workspace-pick",
          src: [source >= target.index + 1 ? source + 1 : source, pickedIndex],
          dst: [target.index + 1, 0],
        };
      } else {
        assertNever(target);
      }
      return {
        type: "success" as const,
        value: {
          ...value,
          contents: newWorkspace,
        },
        actionAnnotation: annotation,
      };
    });
    proceedWith(nextScenes);
  } else if (action.type === "dev-eval") {
    const func = new Function("x", `return (${action.code})`);
    const result = func(scene.value);
    proceedWith([{ type: "success", value: result }]);
  } else if (action.type === "add-triangle-edge") {
    if (scene.value === null) {
      throw new Error("not a triangle");
    }
    proceedWith([
      { type: "success", value: { ...scene.value, [action.edge]: true } },
    ]);
  } else {
    assertNever(action);
  }
}

const lenses: Record<string, LensImpl> = {
  "domino-grid": {
    getPart(lens: Lens & { type: "domino-grid" }, value) {
      const width = value.width - lens.dx;
      const height = value.height - lens.dy;
      if (width < 0 || height < 0) {
        throw new Error(
          `domino lens out of bounds: asked for (${lens.dx}, ${lens.dy}) in ${value.width}x${value.height}`,
        );
      }
      return {
        width,
        height,
        dominoes: value.dominoes.flatMap(([a, b]: any) => {
          const newDomino = [
            [a[0] - lens.dx, a[1] - lens.dy],
            [b[0] - lens.dx, b[1] - lens.dy],
          ];
          const pt1OutOfBounds = newDomino[0][0] < 0 || newDomino[0][1] < 0;
          const pt2OutOfBounds = newDomino[1][0] < 0 || newDomino[1][1] < 0;
          if (pt1OutOfBounds && pt2OutOfBounds) {
            return [];
          }
          if (pt1OutOfBounds || pt2OutOfBounds) {
            throw new Error("Domino bridges in & out");
          }
          return [newDomino];
        }),
      };
    },
    setPart(lens: Lens & { type: "domino-grid" }, value, part) {
      // console.log("calling setPart", lens, value, part);
      return {
        width: value.width,
        height: value.height,
        dominoes: [
          ...value.dominoes,
          ...part.dominoes.map(([a, b]: any) => [
            [a[0] + lens.dx, a[1] + lens.dy],
            [b[0] + lens.dx, b[1] + lens.dy],
          ]),
        ],
      };
    },
  },
  "sierpinski-child": {
    getPart(lens: Lens & { type: "sierpinski-child" }, value: SierpinskiValue) {
      if (value === null) {
        throw new Error("not a triangle");
      }
      return rotateSierpinski(value[lens.child], lens.rot);
    },
    setPart(
      lens: Lens & { type: "sierpinski-child" },
      value: SierpinskiValue,
      part,
    ) {
      return {
        ...value,
        [lens.child]: rotateSierpinski(part, invertRot(lens.rot)),
      };
    },
  },
};

type SierpinskiValue = {
  a: SierpinskiValue;
  b: SierpinskiValue;
  c: SierpinskiValue;
  ab: boolean;
  bc: boolean;
  ac: boolean;
} | null;

type SierpinskiRot = 0 | 1 | 2;

function invertRot(rot: SierpinskiRot): SierpinskiRot {
  return rot === 0 ? 0 : rot === 1 ? 2 : 1;
}

function rotateSierpinski(
  value: SierpinskiValue,
  rot: SierpinskiRot,
): SierpinskiValue {
  if (value === null) {
    return null;
  }
  if (rot === 0) {
    return value;
  } else if (rot === 1) {
    return {
      a: rotateSierpinski(value.b, rot),
      b: rotateSierpinski(value.c, rot),
      c: rotateSierpinski(value.a, rot),
      ab: value.bc,
      bc: value.ac,
      ac: value.ab,
    };
  } else if (rot === 2) {
    return {
      a: rotateSierpinski(value.c, rot),
      b: rotateSierpinski(value.a, rot),
      c: rotateSierpinski(value.b, rot),
      ab: value.ac,
      bc: value.ab,
      ac: value.bc,
    };
  } else {
    assertNever(rot);
  }
}

/**
 * Convenience function to run a flowchart in a typical situation.
 */
export function runHelper(flowcharts: Flowchart[], value: any) {
  const defs = { flowcharts: indexById(flowcharts) };
  const traceTree = makeTraceTree();
  const flowchart = flowcharts[0];
  const initStep: SuccessfulStep = {
    id: "*",
    prevStepId: undefined,
    flowchartId: flowchart.id,
    frameId: flowchart.initialFrameId,
    scene: { type: "success", value },
    caller: undefined,
  };
  try {
    runAll(initStep, defs, traceTree, 0);
  } catch (e) {
    if (e instanceof RangeError) {
      console.error("Infinite loop detected, dumping top of traceTree:");
      log(Object.values(traceTree).slice(10));
    }
    throw e;
  }
  return { traceTree, initStepId: initStep.id, defs, flowchart };
}

export function success(value: any): Scene {
  return { type: "success", value };
}

export function getFinalValues(traceTree: TraceTree): any[] {
  return traceTree.finalStepIds.map(
    (id) => assertSuccessfulValue(traceTree.steps[id]).scene.value,
  );
}

/**
 * We're going to eventually have a visualization that shows a
 * flowchart with the different scenes that occur at each frame. This
 * function makes an extremely cheap version of this visualization.
 *
 * The UI is used instead of this now.
 */
export function scenesByFrame(
  flowchart: Flowchart,
  traceTree: TraceTree,
): Record<string, Scene[]> {
  return Object.fromEntries(
    Object.keys(flowchart.frames).map((id) => [
      id,
      Object.values(traceTree.steps)
        .map(
          (step) =>
            step.flowchartId === flowchart.id &&
            step.frameId === id &&
            step.scene,
        )
        .filter(truthy),
    ]),
  );
}

/**
 * A StackPath corresponds to a stack in the UI. `callPath` is a
 * containment path thru nested call boxes, and `final` identifies
 * where the stack is within the innermost call box.
 */
export type StackPath = {
  callPath: StackPathSegment[];
  final: StackPathSegment;
};
export type StackPathSegment = {
  flowchartId: string;
  frameId: string;
};

export function stackPathToString(stackPath: StackPath) {
  return JSON.stringify(stackPath);
}
export function callPathToString(callPath: StackPathSegment[]) {
  return JSON.stringify(callPath);
}
export function stackPathForStep(step: Step, traceTree: TraceTree): StackPath {
  let callPath: StackPathSegment[];
  if (step.caller) {
    const fakeCallerStep = {
      ...traceTree.steps[step.caller.prevStepId],
      frameId: step.caller.frameId,
    };
    const callerStackPath = stackPathForStep(fakeCallerStep, traceTree);
    callPath = [...callerStackPath.callPath, callerStackPath.final];
  } else {
    callPath = [];
  }

  return {
    callPath,
    final: {
      flowchartId: step.flowchartId,
      frameId: step.frameId,
    },
  };
}

export function getCallerInfo(
  call: Call,
  traceTree: TraceTree,
  defs: Definitions,
) {
  // a previous step must have been successful!
  const prevStep = assertSuccessfulValue(traceTree.steps[call.prevStepId]);
  const flowchart = defs.flowcharts[prevStep.flowchartId];
  const frame = flowchart.frames[call.frameId] as Frame & {
    action: Action & { type: "call" };
  };
  return { prevStep, flowchart, frame };
}

/**
 * We want to show scenes in the context of nested function calls.
 * How to do this in total generality is TBD, but for now we make a
 * simplifying assumption: To see a scene in the context of nested
 * function calls, we will...
 * 1. Draw the top-level scene value, with progress from nested calls
 *    filled in.
 * 2. Draw outlines around the parts of the scene considered at each
 *    level.
 *
 * This means we need to know 1. the top-level scene value, and 2. a
 * series of lenses chained from the top to get to each call. The
 * latter is a stackPath, basically, which you can get with
 * stackPathForStep. So we just need to implement the top-level scene
 * value part.
 */

export function topLevelValueForStep(
  step: Step,
  value: any,
  traceTree: TraceTree,
  defs: Definitions,
): unknown {
  if (step.caller) {
    return topLevelValueForCall(value, step.caller, traceTree, defs);
  } else {
    return value;
  }
}

function topLevelValueForCall(
  nestedValue: unknown,
  call: Call,
  traceTree: TraceTree,
  defs: Definitions,
): unknown {
  const callInfo = getCallerInfo(call, traceTree, defs);
  // BIG TODO: deal with missing lens
  let value: any;
  const lens = callInfo.frame.action.lens;
  if (lens) {
    const lensImpl = lenses[lens.type];
    if (!lensImpl) {
      throw new Error(`Lens type ${lens.type} not found`);
    }
    // figure out the value at this level by simulating early return
    value = lensImpl.setPart(lens, callInfo.prevStep.scene.value, nestedValue);
  } else {
    value = nestedValue;
  }
  // keep recursing if there's more to do
  if (callInfo.prevStep.caller) {
    return topLevelValueForCall(
      value,
      callInfo.prevStep.caller,
      traceTree,
      defs,
    );
  } else {
    return value;
  }
}

export function getNextFrameIds(frameId: string, flowchart: Flowchart) {
  // TODO: what about special arrows?
  return [
    ...flowchart.arrows
      .filter(({ from }) => from === frameId)
      .map(({ to }) => to),
    flowchart.frames[frameId].escapeRouteFrameId,
  ].filter(truthy);
}

export function getPrevFrameIds(frameId: string, flowchart: Flowchart) {
  // TODO: what about special arrows?
  return [
    ...flowchart.arrows
      .filter(({ to }) => to === frameId)
      .map(({ from }) => from),
    ...Object.values(flowchart.frames)
      .filter((frame) => frame.escapeRouteFrameId === frameId)
      .map((frame) => frame.id),
  ];
}

export function stringifyEqual<T>(a: T, b: T) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function getNextSteps(step: Step, traceTree: TraceTree) {
  return Object.values(traceTree.steps).filter(
    ({ prevStepId }) => prevStepId === step.id,
  );
}

/**
 * A "stack" is the set of steps shown at a single location in
 * the diagram (which can be ID'd by a frame path).
 */
export type Stack = {
  stackPath: StackPath;
  stepIds: string[];
};
export type StepsInStacks = {
  stacks: {
    [stackPathStr: string]: Stack;
  };
  stackByStepId: {
    [stepId: string]: Stack;
  };
};

export function putStepsInStacks(tree: TraceTree): StepsInStacks {
  const stacks: { [stackPathId: string]: Stack } = {};
  const stackByStepId: { [stepId: string]: Stack } = {};

  for (const step of Object.values(tree.steps)) {
    const stackPath = stackPathForStep(step, tree);
    const stackPathStr = stackPathToString(stackPath);
    let stack = stacks[stackPathStr];
    if (!stack) {
      stack = stacks[stackPathStr] = { stackPath, stepIds: [] };
    }
    stack.stepIds.push(step.id);
    stackByStepId[step.id] = stack;
  }

  return { stacks, stackByStepId };
}

export function getStackByPath(
  stackPath: StackPath,
  stepsInStacks: StepsInStacks,
): Stack {
  return stepsInStacks.stacks[stackPathToString(stackPath)];
}

export function getPrevStacks(
  stack: Stack,
  stepsInStacks: StepsInStacks,
  traceTree: TraceTree,
): Stack[] {
  const { stackByStepId } = stepsInStacks;

  return Array.from(
    new Set(
      stack.stepIds.flatMap((stepId) => {
        const prevStepId = traceTree.steps[stepId].prevStepId;
        return prevStepId ? [stackByStepId[prevStepId]] : [];
      }),
    ),
  );
}

export function getNextStacks(
  stack: Stack,
  stepsInStacks: StepsInStacks,
  traceTree: TraceTree,
): Stack[] {
  const { stackByStepId } = stepsInStacks;

  return Array.from(
    new Set(
      stack.stepIds.flatMap((stepId) =>
        getNextSteps(traceTree.steps[stepId], traceTree).map(
          (nextStep) => stackByStepId[nextStep.id],
        ),
      ),
    ),
  );
}

export function getNextStacksInLevel(
  stack: Stack,
  stepsInStacks: StepsInStacks,
  defs: Definitions,
): Stack[] {
  const { frameId, flowchartId } = stack.stackPath.final;
  const nextFrameIds = getNextFrameIds(frameId, defs.flowcharts[flowchartId]);
  return nextFrameIds.map((nextFrameId) => {
    const nextStackPath = {
      callPath: stack.stackPath.callPath,
      final: { flowchartId, frameId: nextFrameId },
    };
    return (
      getStackByPath(nextStackPath, stepsInStacks) ?? {
        stackPath: nextStackPath,
        stepIds: [],
      }
    );
  });
}

export function getPrevStacksInLevel(
  stack: Stack,
  stepsInStacks: StepsInStacks,
  defs: Definitions,
): Stack[] {
  const { frameId, flowchartId } = stack.stackPath.final;
  const prevFrameIds = getPrevFrameIds(frameId, defs.flowcharts[flowchartId]);
  return prevFrameIds.map((prevFrameId) => {
    const prevStackPath = {
      callPath: stack.stackPath.callPath,
      final: { flowchartId, frameId: prevFrameId },
    };
    return (
      getStackByPath(prevStackPath, stepsInStacks) ?? {
        stackPath: prevStackPath,
        stepIds: [],
      }
    );
  });
}

export type Viewchart = {
  flowchartId: string;
  stackByFrameId: Record<string, Stack>;
  callViewchartsByFrameId: Record<string, Viewchart>;
  /* just for debugging, I think */
  callPath: StackPathSegment[];
};

export function stepsInStacksToViewchart(
  stepsInStacks: StepsInStacks,
): Viewchart {
  return stepsInStacksToViewchartHelper(
    [],
    Object.values(stepsInStacks.stacks),
  );
}

function stepsInStacksToViewchartHelper(
  callPath: StackPathSegment[],
  stacks: Stack[],
): Viewchart {
  let flowchartId: string | undefined = undefined;
  const stackByFrameId: Record<string, Stack> = {};
  const callViewchartsByFrameId: Record<string, Viewchart> = {};
  const stacksByCallFrameId: Record<string, Stack[]> = {};
  for (const stack of Object.values(stacks)) {
    const isStackAtCallPath =
      callPathToString(stack.stackPath.callPath) === callPathToString(callPath);

    if (isStackAtCallPath) {
      stackByFrameId[stack.stackPath.final.frameId] = stack;
      // TODO hacky
      flowchartId = stack.stackPath.final.flowchartId;
    } else {
      const callFrameId = stack.stackPath.callPath[callPath.length].frameId;
      if (!stacksByCallFrameId[callFrameId]) {
        stacksByCallFrameId[callFrameId] = [];
      }
      stacksByCallFrameId[callFrameId].push(stack);
    }
  }
  if (!flowchartId) {
    throw new Error("No flowchartId?");
  }
  for (const [callFrameId, stacks] of Object.entries(stacksByCallFrameId)) {
    const nextCallPath = [...callPath, { flowchartId, frameId: callFrameId }];
    callViewchartsByFrameId[callFrameId] = stepsInStacksToViewchartHelper(
      nextCallPath,
      stacks,
    );
  }

  return { flowchartId, stackByFrameId, callViewchartsByFrameId, callPath };
}

export function getActionText(action?: Action): string {
  if (!action) {
    return "";
  } else if (action.type === "test-func") {
    return action.label ?? "some action";
  } else if (action.type === "call") {
    // TODO: lens?
    return `call ${action.flowchartId}`;
  } else if (action.type === "place-domino") {
    return "place domino";
  } else if (action.type === "test-cond") {
    return "if";
  } else if (action.type === "start") {
    return "start";
  } else if (action.type === "escape") {
    return "";
  } else if (action.type === "workspace-pick") {
    return (
      "move " +
      (typeof action.index === "number"
        ? `item ${action.index + 1}`
        : `${action.index} item`)
    );
  } else if (action.type === "dev-eval") {
    return `evaluate ${action.code}`;
  } else if (action.type === "add-triangle-edge") {
    return `add edge "${action.edge}"`;
  }
  assertNever(action);
}

/**
 * are we the escape route of some other frame?
 *
 * TODO: simplifying assumption – every frame comes from at most one
 * other frame, so if we're the escape route of some frame we are
 * just generally an escape route
 */
export function isEscapeRoute(frameId: string, flowchart: Flowchart) {
  return Object.values(flowchart.frames).some(
    (frame) => frame.escapeRouteFrameId === frameId,
  );
}
