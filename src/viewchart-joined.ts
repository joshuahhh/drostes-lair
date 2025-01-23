import {
  Definitions,
  Step,
  callActionAnnotation,
  getFrame,
  getNextFrameIds,
} from "./interpreter";
import { ViewchartNode, ViewchartStack } from "./viewchart";

export namespace Joined {
  function stepsOnFrameToViewchartNode(
    steps: Step[],
    calls: { initialStep: Step }[],
    callStack: Step[],
  ): ViewchartNode {
    if (calls.length > 0) {
      const firstCall = calls[0];
      return {
        type: "call",
        flowchartId: firstCall.initialStep.flowchartId,
        initialStack: stepsToViewchartStack(
          calls.map((call) => call.initialStep),
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

  export function stepsToViewchartStack(
    defs: Definitions,
    flowchartId: string,
    frameId: string,
    steps: Step[],
    callStack: Step[],
  ): ViewchartStack {
    const frame = getFrame(defs, { flowchartId, frameId });
    const nextFrameIds = getNextFrameIds(defs, { flowchartId, frameId });
    return {
      type: "stack",
      id: step.id,
      frameId: frameId,
      flowchartId: flowchartId,
      scenes: steps.map((step) => ({ ...step.scene, stepId: step.id })),
      nextNodes: nextFrameIds.map((frameId) => {
        const nextSteps = steps.flatMap(step => step.nextSteps[frameId] || []);
        const nextCalls = steps.flatMap(step => step.nextCalls[frameId] || []);
        stepsOnFrameToViewchartNode(
          nextSteps,
          nextCalls,
          callStack,
        ),
      ),
      someStepIsStuck: step.isStuck,
      isFinal: callDepth === 0 && Object.values(step.nextSteps).length === 0,
      callStack: step.callStack,
    };
  }
}
