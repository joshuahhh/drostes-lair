// STATIC WORLD

import { assertNever, truthy } from "./util";

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
      func: (input: Scene) => Scene[];
    }
  | {
      type: "call";
      flowchartId: string;
      // TODO: for now, calls run at the top level of a frame; this
      // will have to change soon
    }
  | {
      // another fake one
      type: "test-cond";
      func: (input: Scene) => boolean;
      then: Action | undefined;
      else: Action | undefined;
    };

/**
 * If we're going to call one flowchart from another, we need to know
 * what flowcharts are out there.
 */
export type Definitions = {
  flowcharts: Record<string, Flowchart>;
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
  caller:
    | {
        // We need to know:
        // 1. The input to the call
        prevStepId: string;
        // 2. The call that was made
        frameId: string;
      }
    | undefined;
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
  if (nextArrows.length === 0) {
    if (caller === undefined) {
      traceTreeOut.finalStepIds.push(step.id);
      return;
    }

    const callerPrevStep = traceTreeOut.steps[caller.prevStepId];

    const nextStep: Step = {
      id: `${step.id}↑${callerPrevStep.flowchartId}→${caller.frameId}`,
      prevStepId: step.id,
      flowchartId: callerPrevStep.flowchartId,
      frameId: caller.frameId,
      scene, // TODO: replace part of the scene
      caller: callerPrevStep.caller,
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
}

function performAction(
  step: Step,
  nextFrameId: string,
  action: Action | undefined,
  defs: Definitions,
  traceTreeOut: TraceTree,
): void {
  const { flowchartId, scene, caller } = step;

  if (!action || action.type === "test-func") {
    const nextScenes = action ? action.func(scene) : [scene];
    let i = 0;
    for (const nextScene of nextScenes) {
      const nextStep: Step = {
        id: `${step.id}→${nextFrameId}${nextScenes.length > 1 ? `[${i++}]` : ""}`,
        prevStepId: step.id,
        flowchartId,
        frameId: nextFrameId,
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
    const nextStep: Step = {
      id: `${step.id}→${nextFrameId}↓${nextFlowchart.id}`,
      prevStepId: step.id,
      flowchartId: action.flowchartId,
      frameId: nextFlowchart.initialFrameId,
      scene,
      caller: {
        prevStepId: step.id,
        frameId: nextFrameId,
      },
    };
    runAll(nextStep, defs, traceTreeOut);
    return;
  }
  if (action.type === "test-cond") {
    const nextAction = action.func(scene) ? action.then : action.else;
    performAction(step, nextFrameId, nextAction, defs, traceTreeOut);
    return;
  }
  assertNever(action);
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
