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
      type: "start";
    }
  | {
      // this one won't be used in the real deal; we'll want to have
      // better ways than opaque functions to specify & show actions
      type: "test-func";
      label?: string;
      func: (input: Scene) => Scene[];
      failureFrameId?: string;
    }
  | {
      type: "place-domino";
      domino: [[number, number], [number, number]];
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

  function proceedWith(nextScenes: Scene[]) {
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
  }

  if (!action || action.type === "start") {
    proceedWith([scene]);
  } else if (action.type === "test-func") {
    let nextScenes: Scene[];
    try {
      nextScenes = action.func(scene);
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
    proceedWith(nextScenes);
  } else if (action.type === "place-domino") {
    const { domino } = action;
    performAction(
      step,
      frameId,
      {
        type: "test-func",
        label: "place domino",
        func: ({ value }) => {
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
            throw new Error("domino out of bounds");
          }
          return [
            {
              value: {
                ...value,
                dominoes: [...value.dominoes, action.domino],
              },
            },
          ];
        },
        failureFrameId: action.failureFrameId,
      },
      defs,
      traceTreeOut,
    );
  } else if (action.type === "call") {
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
  } else if (action.type === "test-cond") {
    const nextAction = action.func(scene) ? action.then : action.else;
    performAction(step, frameId, nextAction, defs, traceTreeOut);
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
  return { traceTree, initStepId: initStep.id, defs };
}

export function getFinalValues(traceTree: TraceTree): any[] {
  return traceTree.finalStepIds.map((id) => traceTree.steps[id].scene.value);
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
 * latter is a stackPath, basically, which you can get with
 * stackPathForStep. So we just need to implement the top-level scene
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

export function getNextFrameIds(frameId: string, flowchart: Flowchart) {
  // TODO: what about special arrows?
  return flowchart.arrows
    .filter(({ from }) => from === frameId)
    .map(({ to }) => to);
}

export function getPrevFrameIds(frameId: string, flowchart: Flowchart) {
  // TODO: what about special arrows?
  return flowchart.arrows
    .filter(({ to }) => to === frameId)
    .map(({ from }) => from);
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
  return nextFrameIds.flatMap((nextFrameId) => {
    const nextStackPath = {
      callPath: stack.stackPath.callPath,
      final: { flowchartId, frameId: nextFrameId },
    };
    return getStackByPath(nextStackPath, stepsInStacks) ?? [];
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
    return getStackByPath(prevStackPath, stepsInStacks);
  });
}

export type Viewchart = {
  flowchartId: string;
  stackByFrameId: Record<string, Stack>;
  callViewchartsByFrameId: Record<string, Viewchart>;
  /* just for debugging, I think */
  callPath: StackPathSegment[];
};

// in the UI, we use reference equality on stacks, so we don't want
// to run putStepsInStacks every time. for that reason, this is a
// dangerous function. (ideally, I guess we wouldn't use reference
// equality in the UI)

// export function traceTreeToViewchart(traceTree: TraceTree): Viewchart {
//   const stacks = putStepsInStacks(traceTree);
//   return traceTreeToViewchartHelper([], stacks);
// }

export function stepsInStacksToViewchart(
  stepsInStacks: StepsInStacks,
): Viewchart {
  return traceTreeToViewchartHelper([], stepsInStacks);
}

function traceTreeToViewchartHelper(
  callPath: StackPathSegment[],
  stacks: StepsInStacks,
): Viewchart {
  let flowchartId: string | undefined = undefined;
  const stackByFrameId: Record<string, Stack> = {};
  const callViewchartsByFrameId: Record<string, Viewchart> = {};
  const callFrameIds = new Set<string>();
  for (const stack of Object.values(stacks.stackByStepId)) {
    const isStackAtCallPath =
      callPathToString(stack.stackPath.callPath) === callPathToString(callPath);

    if (isStackAtCallPath) {
      stackByFrameId[stack.stackPath.final.frameId] = stack;
      // TODO hacky
      flowchartId = stack.stackPath.final.flowchartId;
    }

    // callPath is a prefix of stack.stackPath.callPath
    const isStackDeeperThanCallPath = callPath.every(
      (segment, i) =>
        JSON.stringify(segment) === JSON.stringify(stack.stackPath.callPath[i]),
    );
    if (isStackDeeperThanCallPath && !isStackAtCallPath) {
      callFrameIds.add(stack.stackPath.callPath[callPath.length].frameId);
    }
  }
  if (!flowchartId) {
    throw new Error("No flowchartId?");
  }
  for (const frameId of callFrameIds) {
    const nextCallPath = [...callPath, { flowchartId, frameId }];
    callViewchartsByFrameId[frameId] = traceTreeToViewchartHelper(
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
  }
  assertNever(action);
}
