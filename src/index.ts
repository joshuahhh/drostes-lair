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
      type: "test";
      func: (input: Scene) => Scene[];
    }
  | {
      type: "call";
      flowchartId: string;
      // TODO: for now, calls run at the top level of a frame; this
      // will have to change soon
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
  prevId?: string;
  frameId: string;
  flowchartId: string;
  scene: Scene;
  callerId?: string;
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

  const { flowchartId, frameId, scene } = step;
  const flowchart = defs.flowcharts[flowchartId];
  const nextArrows = flowchart.arrows.filter(({ from }) => from === frameId);

  // TODO: If there are no further arrows, we assume the flowchart is
  // done. Design decision!
  if (nextArrows.length === 0) {
    traceTreeOut.finalStepIds.push(step.id);
    return;
  }

  // Otherwise, we follow all arrows.
  for (const nextArrow of nextArrows) {
    const nextFrameId = nextArrow.to;
    const nextFrame = flowchart.frames[nextFrameId];
    if (!nextFrame) {
      throw new Error(`Frame ${nextFrameId} not found`);
    }
    if (!nextFrame.action || nextFrame.action.type === "test") {
      const nextScenes = nextFrame.action
        ? nextFrame.action.func(scene)
        : [scene];
      for (const nextScene of nextScenes) {
        const nextStep = {
          id: `${step.id}→${nextFrameId}`,
          prevId: step.id,
          flowchartId,
          frameId: nextFrameId,
          scene: nextScene,
        };
        runAll(nextStep, defs, traceTreeOut);
      }
      return;
    }
    if (nextFrame.action.type === "call") {
      throw new Error("Not implemented");
    }
    assertNever(nextFrame.action);
  }
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
        .map((step) => step.frameId === id && step.scene)
        .filter(truthy),
    ]),
  );
}
