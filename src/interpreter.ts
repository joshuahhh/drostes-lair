// STATIC WORLD

import { assertNever, indexById, log, truthy } from "./util";

export type Flowchart = {
  id: string;
  initialFrameId: string;
  frames: { [id: string]: Frame };
  arrows: { from: string; to: string }[];
};

export type Frame = {
  id: string;
  action?: Action;
};

export type Action =
  | {
      // this one won't be used in the real deal; we'll want to have
      // better ways than opaque functions to specify & show actions
      type: "test-func";
      label?: string;
      func: (input: Scene) => Scene[];
      failureFrameId?: string;
    }
  | {
      type: "call";
      flowchartId: string;
      lens?: Lens;
    }
  | {
      // another fake one
      type: "test-cond";
      func: (input: Scene) => boolean;
      then: Action | undefined;
      else: Action | undefined;
    };

export type Lens = {
  type: "domino-grid";
  dx: number;
  dy: number;
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
export type Scene = {
  value: any;
};

// FUNCTIONS

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
  step: Step,
  defs: Definitions,
  traceTreeOut: TraceTree,
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

      let returnScene = scene;
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
            callerInfo.prevStep.scene.value,
            scene.value,
          ),
        };
      }

      const nextStep: Step = {
        id: `${step.id}↑${callerInfo.flowchart.id}→${caller.frameId}`,
        prevStepId: step.id,
        flowchartId: callerInfo.flowchart.id,
        frameId: caller.frameId,
        scene: returnScene,
        caller: callerInfo.prevStep.caller,
      };
      runAll(nextStep, defs, traceTreeOut);
      return;
    }

    // Otherwise, we follow all arrows.
    for (const nextArrow of nextArrows) {
      const nextFrameId = nextArrow.to;
      const nextFrame = flowchart.frames[nextFrameId];
      if (!nextFrame) {
        throw new Error(`Frame ${nextFrameId} not found`);
      }
      performAction(step, nextFrameId, nextFrame.action, defs, traceTreeOut);
    }
  } finally {
    RUN_ALL_DEPTH--;
  }
}

function performAction(
  step: Step,
  frameId: string,
  action: Action | undefined,
  defs: Definitions,
  traceTreeOut: TraceTree,
): void {
  const { flowchartId, scene, caller } = step;

  if (!action || action.type === "test-func") {
    let nextScenes;
    try {
      nextScenes = action ? action.func(scene) : [scene];
    } catch (e) {
      if (action && action.failureFrameId) {
        const nextStep: Step = {
          id: `${step.id}→${frameId}↝${action.failureFrameId}`,
          prevStepId: step.id,
          flowchartId,
          frameId: action.failureFrameId,
          scene,
          caller,
        };
        runAll(nextStep, defs, traceTreeOut);
        return;
      } else {
        // TODO: if there's no failure path, we abort this branch of
        // the trace (not as a final branch)
        return;
      }
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
      runAll(nextStep, defs, traceTreeOut);
    }
    return;
  }
  if (action.type === "call") {
    // time to step into the call
    const nextFlowchart = defs.flowcharts[action.flowchartId];
    if (!nextFlowchart) {
      throw new Error(`Flowchart ${action.flowchartId} not found`);
    }
    let callScene = scene;
    if (action.lens) {
      const lensImpl = lenses[action.lens.type];
      if (!lensImpl) {
        throw new Error(`Lens type ${action.lens.type} not found`);
      }
      callScene = {
        ...scene,
        value: lensImpl.getPart(action.lens, scene.value),
      };
    }
    const nextStep: Step = {
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
    runAll(nextStep, defs, traceTreeOut);
    return;
  }
  if (action.type === "test-cond") {
    const nextAction = action.func(scene) ? action.then : action.else;
    performAction(step, frameId, nextAction, defs, traceTreeOut);
    return;
  }
  assertNever(action);
}

const lenses: Record<string, LensImpl> = {
  "domino-grid": {
    getPart(lens: Lens & { type: "domino-grid" }, value) {
      const width = value.width - lens.dx;
      const height = value.height - lens.dy;
      if (width < 0 || height < 0) {
        throw new Error("Lens out of bounds");
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
};

/**
 * Convenience function to run a flowchart in a typical situation.
 */
export function runHelper(flowcharts: Flowchart[], value: any) {
  const defs = { flowcharts: indexById(flowcharts) };
  const traceTree = makeTraceTree();
  const flowchart = flowcharts[0];
  const initStep = {
    id: "*",
    prevStepId: undefined,
    flowchartId: flowchart.id,
    frameId: flowchart.initialFrameId,
    scene: { value },
    caller: undefined,
  };
  try {
    runAll(initStep, defs, traceTree);
  } catch (e) {
    if (e instanceof RangeError) {
      console.error("Infinite loop detected, dumping top of traceTree:");
      log(Object.values(traceTree).slice(10));
    }
    throw e;
  }
  return { traceTree, flowchart, initStepId: initStep.id, defs };
}

export function getFinalValues(traceTree: TraceTree): any[] {
  return traceTree.finalStepIds.map((id) => traceTree.steps[id].scene.value);
}

/**
 * We're going to eventually have a visualization that shows a
 * flowchart with the different scenes that occur at each frame. This
 * function makes an extremely cheap version of this visualization.
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
 * A frame in the UI is identified by a "frame path" – describing in
 * static terms the sequence of calls that led to it, from top to
 * bottom. It's expected that every frame here besides the last is a
 * call.
 */
export type FramePath = {
  flowchartId: string;
  frameId: string;
}[];

export function framePathToString(framePath: FramePath) {
  return JSON.stringify(framePath);
}

export function framePathForStep(step: Step, traceTree: TraceTree): FramePath {
  const rest = step.caller
    ? framePathForStep(
        // TODO: does this work?
        {
          ...traceTree.steps[step.caller.prevStepId],
          frameId: step.caller.frameId,
        },
        traceTree,
      )
    : [];
  return [...rest, { flowchartId: step.flowchartId, frameId: step.frameId }];
}

export function getCallerInfo(
  call: Call,
  traceTree: TraceTree,
  defs: Definitions,
) {
  const prevStep = traceTree.steps[call.prevStepId];
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
 * latter is a FramePath, basically, which you can get with
 * framePathForStep. So we just need to implement the top-level scene
 * value part.
 */

export function topLevelValueForStep(
  step: Step,
  traceTree: TraceTree,
  defs: Definitions,
): unknown {
  if (step.caller) {
    return topLevelValueForCall(step.scene.value, step.caller, traceTree, defs);
  } else {
    return step.scene.value;
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
  const lens = callInfo.frame.action.lens!;
  const lensImpl = lenses[lens.type];
  if (!lensImpl) {
    throw new Error(`Lens type ${lens.type} not found`);
  }
  // figure out the value at this level by simulating early return
  const value = lensImpl.setPart(
    lens,
    callInfo.prevStep.scene.value,
    nestedValue,
  );
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
  framePath: FramePath;
  steps: Step[];
};
export type StepsInStacks = {
  stackByStepId: {
    [stepId: string]: Stack;
  };
};

export function putStepsInStacks(tree: TraceTree): StepsInStacks {
  const stacks: { [framePathId: string]: Stack } = {};
  const stackByStepId: { [stepId: string]: Stack } = {};

  for (const step of Object.values(tree.steps)) {
    const framePath = framePathForStep(step, tree);
    const framePathStr = framePathToString(framePath);
    let stack = stacks[framePathStr];
    if (!stack) {
      stack = stacks[framePathStr] = { framePath, steps: [] };
    }
    stack.steps.push(step);
    stackByStepId[step.id] = stack;
  }

  return { stackByStepId };
}

export function getPrevStacks(
  stack: Stack,
  stepsInStacks: StepsInStacks,
): Stack[] {
  const { stackByStepId } = stepsInStacks;

  return Array.from(
    new Set(
      stack.steps.flatMap((step) =>
        step.prevStepId ? [stackByStepId[step.prevStepId]] : [],
      ),
    ),
  );
}

export function getNextStacks(
  stack: Stack,
  stepsInStacks: StepsInStacks,
  traceTree: TraceTree,
): Stack[] {
  const { stackByStepId } = stepsInStacks;

  const nextStacks: Set<Stack> = new Set();
  stack.steps.forEach((step) => {
    for (const nextStep of getNextSteps(step, traceTree)) {
      nextStacks.add(stackByStepId[nextStep.id]);
    }
  });

  return Array.from(nextStacks);
}
