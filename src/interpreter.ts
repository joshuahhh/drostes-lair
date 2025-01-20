import { assertNever, indexById, truthy } from "./util";

// STATIC WORLD

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
      func: (value: any) => ActionResult;
    }
  | {
      type: "place-domino";
      domino: [[number, number], [number, number]];
    }
  | {
      type: "call";
      flowchartId: string;
      lens?: Lens;
    }
  | {
      // another fake one
      type: "test-assert";
      func: (input: any) => boolean;
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
      type: "dev-eval";
      code: string;
    };

export type ActionAnnotation =
  | {
      type: "call";
      initialStep: Step;
      returningStepId: string;
    }
  | {
      type: "workspace-pick";
      src: [number, number];
      dst: [number, number];
    };

export type ErrorAnnotation =
  | {
      type: "scene";
      /* This is a scene that shows what was attempted, as though it
      succeeded. */
      scene: Scene & { type: "success" };
    }
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

export function getFrame(
  defs: Definitions,
  { flowchartId, frameId }: { flowchartId: string; frameId: string },
) {
  return defs.flowcharts[flowchartId].frames[frameId];
}

// IMPLEMENTATION WORLD

export type LensImpl<L extends Lens = Lens, V = any> = {
  // TODO: using "value" here rather than "scene" for convenience; if
  // a scene is ever more than just a value we'll have to figure this
  // out
  getPart(lens: L, value: V): any;
  setPart(lens: L, value: V, part: V): any;
};

export function lensImpl<LType, V>(impl: LensImpl<Lens & { type: LType }, V>) {
  return impl;
}

export type DominoesValue = {
  width: number;
  height: number;
  dominoes: [[number, number], [number, number]][];
};
export function isDominoesValue(value: any): value is DominoesValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "width" in value &&
    "height" in value &&
    "dominoes" in value
  );
}

export type WorkspaceValue = {
  type: "workspace";
  contents: unknown[][];
};
export function isWorkspaceValue(value: any): value is WorkspaceValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "workspace" &&
    "contents" in value
  );
}

// DYNAMIC WORLD

/* A "Step" is the trace of an action and everything downstream of
it. */
export type Step = {
  id: string;
  frameId: string;
  flowchartId: string;
  scene: Scene;
  nextSteps: { [frameId: string]: Step[] };
  isStuck: boolean;
};

/**
 * A scene is the state of the world inside a frame. For now we just
 * represent it as an arbitrary value; who knows what might come
 * later.
 */
export type Scene =
  | {
      type: "success";
      value: unknown;
      // This is metadata provided by the action that produced this
      // scene, providing information to help illustrate the action.
      actionAnnotation?: ActionAnnotation;
    }
  | {
      type: "error";
      message: string;
      errorAnnotation?: ErrorAnnotation;
    };

export type SuccessfulScene = Scene & { type: "success" };
export type SuccessfulStep = Step & { scene: SuccessfulScene };

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

export type RunContext = {
  /* A stack of call step ids */
  callStack: string[];
  /* Definitions in effect for the run. */
  defs: Definitions;
};

/* This function doesn't know anything about the flowchart's
caller. */
export function runFlowchart(
  ctx: RunContext,
  flowchartId: string,
  scene: SuccessfulScene,
): { initialStep: Step; exitingSteps: SuccessfulStep[] } {
  const flowchart = ctx.defs.flowcharts[flowchartId];
  const { steps, exitingSteps } = runPreFrame(
    ctx,
    ctx.callStack.map((n) => n + "/").join(""),
    scene,
    flowchartId,
    flowchart.initialFrameId,
  );
  if (steps.length !== 1) {
    throw new Error(
      `INTERNAL ERROR: initial frame in runFlowchart produced ${steps.length} steps; should produce 1`,
    );
  }
  const initialStep = steps[0];
  return { initialStep, exitingSteps };
}

/* Run a frame, starting with an input scene, producing a set of
immediate steps. (So, if frame A goes into frame B, you take the
output scene of a frame-A step and feed it into runFrame with frame B
info and it will give you a set of steps the frame-A step should lead
to.) */
export function runPreFrame(
  ctx: RunContext,
  inputStepId: string,
  inputScene: SuccessfulScene,
  flowchartId: string,
  frameId: string,
): {
  /* Steps immediately produced */
  steps: Step[];
  /* All downstream steps exiting this flow-chart */
  exitingSteps: SuccessfulStep[];
} {
  const frame = getFrame(ctx.defs, { flowchartId, frameId });

  let stepId = `${inputStepId}→${frameId}`;

  // Apply the action to produce output scenes
  try {
    const scenes = applyAction(ctx, inputStepId, inputScene, frame.action);
    if (scenes.length === 0) {
      // TODO: we currently regard an empty set of output scenes as a
      // failure, so that, e.g., you can provide an escape route if
      // "move any item" is called on an empty list. this is all
      // weird and hacky and deserves more thought.
      throw new ErrorWithAnnotation("no way to go", {
        type: "scene",
        scene: inputScene,
      });
    }
    // We have scenes for the immediate steps. Now we run each one to
    // completion. Remember: Each scene lives on ME (this frameId).
    const steps: Step[] = [];
    const exitingSteps: SuccessfulStep[] = [];
    for (const [i, { scene, key }] of scenes.entries()) {
      const result = runPostFrame(
        ctx,
        `${stepId}[${key}]`,
        scene,
        flowchartId,
        frameId,
      );
      steps.push(result.step);
      exitingSteps.push(...result.exitingSteps);
    }

    return { steps: steps, exitingSteps };
  } catch (e) {
    let scene: Scene = { type: "error", message: "unknown" };
    if (e instanceof ErrorWithAnnotation) {
      scene = {
        ...scene,
        message: e.message,
        errorAnnotation: e.annotation,
      };
    } else if (e instanceof Error) {
      scene = { ...scene, message: e.message };
    }
    const nextStep: Step = {
      id: stepId,
      frameId,
      flowchartId,
      nextSteps: {},
      scene,
      isStuck: false, // stuck is for successful steps
    };
    return { steps: [nextStep], exitingSteps: [] };
  }
}

/* Run a frame, starting with an OUTPUT scene, producing a single
step. */
export function runPostFrame(
  ctx: RunContext,
  outputStepId: string,
  outputScene: Scene,
  flowchartId: string,
  frameId: string,
): { step: Step; exitingSteps: SuccessfulStep[] } {
  // TODO: figure out stuckness
  // if (continuations.every(({ step }) => step.scene.type === "error")) {

  const flowchart = ctx.defs.flowcharts[flowchartId];
  const frame = flowchart.frames[frameId];

  const nextArrows = flowchart.arrows.filter(({ from }) => from === frameId);

  // We will evolve these as we follow arrows
  const step: Step = {
    id: outputStepId,
    frameId,
    flowchartId,
    nextSteps: {},
    scene: outputScene,
    isStuck: false,
  };
  const exitingSteps: SuccessfulStep[] = [];

  // Errors are done, and don't exit the flowchart
  if (step.scene.type === "error") {
    return { step, exitingSteps: [] };
  }
  assertSuccessful(step);

  // If there are no further arrows, we assume the current flowchart
  // is done and return it as an exiting step.
  if (nextArrows.length === 0) {
    return { step, exitingSteps: [step] };
  }

  // Otherwise, we follow all arrows.
  let continuedSuccessfully = false;
  for (const nextArrow of nextArrows) {
    const nextFrameId = nextArrow.to;
    const nextFrame = flowchart.frames[nextFrameId];
    if (!nextFrame) {
      throw new Error(`Frame ${nextFrameId} not found`);
    }

    const followResult = runPreFrame(
      ctx,
      outputStepId,
      step.scene,
      flowchartId,
      nextFrameId,
    );
    step.nextSteps[nextFrameId] = followResult.steps;
    exitingSteps.push(...followResult.exitingSteps);

    if (
      // Criteria for successful continuation...
      followResult.steps.some((step) => step.scene.type === "success")
    ) {
      continuedSuccessfully = true;
    }
  }

  if (!continuedSuccessfully) {
    step.isStuck = true;
    if (frame.escapeRouteFrameId) {
      const followResult = runPreFrame(
        ctx,
        outputStepId,
        step.scene,
        flowchartId,
        frame.escapeRouteFrameId,
      );
      step.nextSteps[frame.escapeRouteFrameId] = followResult.steps;
      exitingSteps.push(...followResult.exitingSteps);
    }
  }

  return { step, exitingSteps };
}

export type ActionResult = { scene: Scene; key: string }[];

function applyAction(
  ctx: RunContext,
  stepId: string,
  scene: SuccessfulScene,
  action: Action | undefined,
): ActionResult {
  if (!action || action.type === "start" || action.type === "escape") {
    return [{ scene: { ...scene, actionAnnotation: undefined }, key: "" }];
  } else if (action.type === "call") {
    return applyCall(ctx, stepId, scene, action);
  } else if (action.type === "test-func") {
    return action.func(scene.value);
  } else if (action.type === "place-domino") {
    const { domino } = action;
    const value = scene.value as DominoesValue;
    const newScene: Scene = {
      type: "success",
      value: {
        ...value,
        dominoes: [...value.dominoes, action.domino],
      } satisfies DominoesValue,
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
    return [{ scene: newScene, key: "" }];
  } else if (action.type === "test-assert") {
    if (!action.func(scene.value)) {
      throw new Error("assertion failed");
    }
    return [{ scene: { ...scene, actionAnnotation: undefined }, key: "" }];
  } else if (action.type === "workspace-pick") {
    return applyActionWorkspacePick(scene, action);
  } else if (action.type === "dev-eval") {
    const func = new Function("x", `return (${action.code})`);
    const result = func(scene.value);
    return [{ scene: { type: "success", value: result }, key: "" }];
  } else {
    assertNever(action);
  }
}

function applyCall(
  ctx: RunContext,
  stepId: string,
  scene: SuccessfulScene,
  action: Action & { type: "call" },
): ActionResult {
  const lens = action.lens;

  // Prepare initial scene, using lens if necessary
  let initialScene = {
    ...scene,
    actionAnnotation: undefined,
  };
  if (lens) {
    const lensImpl = lenses[lens.type];
    if (!lensImpl) {
      throw new Error(`Lens type ${lens.type} not found`);
    }
    initialScene = {
      ...scene,
      value: lensImpl.getPart(lens, scene.value),
      actionAnnotation: undefined,
    };
  }

  // Run the call
  const { initialStep, exitingSteps } = runFlowchart(
    {
      ...ctx,
      callStack: [...ctx.callStack, stepId],
    },
    action.flowchartId,
    initialScene,
  );

  // Prepare returned scenes, using lens if necessary
  const result: ActionResult = [];
  for (const exitingStep of exitingSteps) {
    let returnScene: Scene = {
      ...exitingStep.scene,
      actionAnnotation: {
        type: "call",
        initialStep,
        returningStepId: exitingStep.id,
      },
    };
    if (lens) {
      const lensImpl = lenses[lens.type];
      if (!lensImpl) {
        throw new Error(`Lens type ${lens.type} not found`);
      }
      returnScene = {
        ...returnScene,
        value: lensImpl.setPart(lens, scene.value, returnScene.value),
      };
    }
    result.push({ scene: returnScene, key: exitingStep.id });
  }

  return result;
}

function applyActionWorkspacePick(
  scene: SuccessfulScene,
  action: Action & { type: "workspace-pick" },
): ActionResult {
  const { source, index, target } = action;
  const value = scene.value as any;
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
  return pickedIndices.map((pickedIndex) => {
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
      scene: {
        type: "success" as const,
        value: {
          ...value,
          contents: newWorkspace,
        },
        actionAnnotation: annotation,
      },
      key: `${pickedIndex}`,
    };
  });
}

const lenses: Record<string, LensImpl> = {
  "domino-grid": lensImpl<"domino-grid", DominoesValue>({
    getPart(lens, value) {
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
    setPart(lens, value, part) {
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
  }),
};

/**
 * Convenience function to run a flowchart in a typical situation.
 */
export function runHelper(flowcharts: Flowchart[], value: any) {
  const defs: Definitions = { flowcharts: indexById(flowcharts) };
  const ctx: RunContext = { defs, callStack: [] };
  return runFlowchart(ctx, flowcharts[0].id, { type: "success", value });
}

export function exitingValues(steps: SuccessfulStep[]) {
  return steps.map((step) => step.scene.value);
}

export function success(value: any): Scene {
  return { type: "success", value };
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
  } else if (action.type === "test-assert") {
    return "assert";
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
