import { ActionAnnotation, Scene, Step, SuccessfulScene } from "./interpreter";
import { assert } from "./util";

export type SceneWithId = Scene & { stepId: string };
// TODO: when will it end
export type SuccessfulSceneWithId = SuccessfulScene & { stepId: string };

export type ViewchartNode =
  | ViewchartStack
  | ViewchartCall
  | ViewchartStackGroup;

export type ViewchartStack = {
  type: "stack";
  id: string;
  frameId: string;
  flowchartId: string;
  scenes: SceneWithId[];
  nextNodes: ViewchartNode[];
  someStepIsStuck: boolean;
};

export type ViewchartStackGroup = {
  type: "stack-group";
  nextStacks: ViewchartStack[];
};

export type ViewchartCall = {
  type: "call";
  flowchartId: string;
  initialStack: ViewchartStack;
  exitStacks: { [innerStackId: string]: ViewchartStack };
  callDepth: number;
};

function actionAnnotationOfCall(
  scene: Scene,
): (ActionAnnotation & { type: "call" }) | undefined {
  if (scene.type === "success" && scene.actionAnnotation?.type === "call") {
    return scene.actionAnnotation;
  }
}

function stepsOnFrameToViewchartNode(
  steps: Step[],
  callDepth: number,
): ViewchartNode {
  assert(steps.length > 0);
  const maybeCall = actionAnnotationOfCall(steps[0].scene);
  if (maybeCall) {
    return {
      type: "call",
      flowchartId: steps[0].flowchartId,
      initialStack: stepToViewchartStack(
        maybeCall.initialStep,
        callDepth + 1,
      ) as ViewchartStack,
      exitStacks: Object.fromEntries(
        steps.map((step) => [
          actionAnnotationOfCall(step.scene)!.returningStepId,
          stepToViewchartStack(step, callDepth),
        ]),
      ),
      callDepth: callDepth + 1,
    };
  } else {
    if (steps.length === 1) {
      return stepToViewchartStack(steps[0], callDepth);
    } else {
      return {
        type: "stack-group",
        nextStacks: steps.map((step) => stepToViewchartStack(step, callDepth)),
      };
    }
  }
}

export function stepToViewchartStack(
  step: Step,
  callDepth: number,
): ViewchartStack {
  return {
    type: "stack",
    id: step.id,
    frameId: step.frameId,
    flowchartId: step.flowchartId,
    scenes: [{ ...step.scene, stepId: step.id }],
    nextNodes: Object.values(step.nextSteps).map((nextSteps) =>
      stepsOnFrameToViewchartNode(nextSteps, callDepth),
    ),
    someStepIsStuck: step.isStuck,
  };
}
