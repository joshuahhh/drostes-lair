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

      const callerPrevStep = traceTreeOut.steps[caller.prevStepId];

      let returnScene = scene;
      const callerFrame =
        defs.flowcharts[callerPrevStep.flowchartId].frames[caller.frameId];
      const callerLens = (callerFrame.action! as Action & { type: "call" })
        .lens;
      if (callerLens) {
        const lensImpl = lenses[callerLens.type];
        if (!lensImpl) {
          throw new Error(`Lens type ${callerLens.type} not found`);
        }
        returnScene = {
          ...scene,
          value: lensImpl.setPart(
            callerLens,
            callerPrevStep.scene.value,
            scene.value,
          ),
        };
      }

      const nextStep: Step = {
        id: `${step.id}↑${callerPrevStep.flowchartId}→${caller.frameId}`,
        prevStepId: step.id,
        flowchartId: callerPrevStep.flowchartId,
        frameId: caller.frameId,
        scene: returnScene,
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
  return { traceTree, flowchart, initStepId: initStep.id };
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
 * static terms the sequence of calls that led to it. This might
 * compute that for a step correctly? Or not.
 */
export function framePathForStep(
  step: Step,
  traceTree: TraceTree,
): { flowchartId: string; frameId: string }[] {
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
  return [{ flowchartId: step.flowchartId, frameId: step.frameId }, ...rest];
}
