import { Step, callActionAnnotation } from "./interpreter";
import { ViewchartNode, ViewchartStack } from "./viewchart";

export namespace Split {
  function stepsOnFrameToViewchartNode(
    steps: Step[],
    maybeCall: { initialStep: Step } | undefined,
    callDepth: number,
  ): ViewchartNode {
    if (maybeCall) {
      return {
        type: "call",
        flowchartId: maybeCall.initialStep.flowchartId,
        initialStack: stepToViewchartStack(
          maybeCall.initialStep,
          callDepth + 1,
        ) as ViewchartStack,
        exitStacks: Object.fromEntries(
          steps.map((step) => [
            callActionAnnotation(step.scene).returningStepId,
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
          nextStacks: steps.map((step) =>
            stepToViewchartStack(step, callDepth),
          ),
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
      nextNodes: Object.entries(step.nextSteps).map(([frameId, nextSteps]) =>
        stepsOnFrameToViewchartNode(
          nextSteps,
          step.nextCalls[frameId],
          callDepth,
        ),
      ),
      someStepIsStuck: step.isStuck,
      isFinal: callDepth === 0 && Object.values(step.nextSteps).length === 0,
      callStack: step.callStack,
    };
  }
}
