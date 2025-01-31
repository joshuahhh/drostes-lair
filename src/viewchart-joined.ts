import {
  Definitions,
  Step,
  callActionAnnotation,
  getNextFrameIds,
} from "./interpreter";
import { truthy } from "./util";
import { ViewchartCall, ViewchartStack } from "./viewchart";

export namespace Joined {
  export const name = "joined";

  export function initialStepToViewchartStack(
    defs: Definitions,
    initialStep: Step,
  ) {
    return stepsToViewchartStack(
      defs,
      initialStep.flowchartId,
      initialStep.frameId,
      [initialStep],
      [],
      {},
    );
  }

  // A stack in the joined viewchart is a frame in a flowchart, which
  // itself might be in a call that comes from a frame in another
  // flowchart, etc.

  type JoinedCallStack = JoinedCallRecord[];
  type JoinedCallRecord = {
    framechartId: string;
    // the frame of the call
    frameId: string;
  };
  function stringifyJoinedCallStack(callStack: JoinedCallStack): string {
    return JSON.stringify(callStack);
  }

  // given a set of steps that belong on a stack together, put em together!
  export function stepsToViewchartStack(
    defs: Definitions,
    flowchartId: string,
    frameId: string,
    steps: Step[],
    callStack: JoinedCallStack,
    stepIdToStackId: { [stepId: string]: string },
  ): ViewchartStack {
    const nextFrameIds = getNextFrameIds(defs, { flowchartId, frameId });
    const stackId = stringifyJoinedCallStack(callStack) + "/" + frameId;
    for (const step of steps) {
      stepIdToStackId[step.id] = stackId;
    }
    return {
      type: "stack",
      id: stackId,
      frameId: frameId,
      flowchartId: flowchartId,
      steps,
      nextNodes: nextFrameIds
        .map((nextFrameId) => {
          const nextSteps = steps.flatMap(
            (step) => step.nextSteps[nextFrameId] || [],
          );
          const nextCalls = steps.flatMap(
            (step) => step.nextCalls[nextFrameId] || [],
          );
          if (nextCalls.length === 0) {
            if (nextSteps.length === 0) {
              return undefined;
            } else {
              return stepsToViewchartStack(
                defs,
                flowchartId,
                nextFrameId,
                nextSteps,
                callStack,
                stepIdToStackId,
              );
            }
          } else {
            // we assume that all nextSteps are returns from the
            // nextCalls
            return callsToViewchartCall(
              defs,
              flowchartId,
              nextFrameId,
              nextSteps,
              nextCalls,
              callStack,
              stepIdToStackId,
            );
          }
        })
        .filter(truthy),
      someStepIsStuck: steps.some((step) => step.isStuck),
      isFinal: callStack.length === 0 && nextFrameIds.length === 0,
    };
  }

  function callsToViewchartCall(
    defs: Definitions,
    flowchartId: string,
    frameId: string,
    steps: Step[],
    calls: { initialStep: Step }[],
    callStack: JoinedCallStack,
    stepIdToStackId: { [stepId: string]: string },
  ): ViewchartCall {
    const stepIdToStackIdForInside: { [stepId: string]: string } = {};
    const initialStack = stepsToViewchartStack(
      defs,
      calls[0].initialStep.flowchartId,
      calls[0].initialStep.frameId,
      calls.map((call) => call.initialStep),
      [...callStack, { framechartId: flowchartId, frameId }],
      stepIdToStackIdForInside,
    );
    return {
      type: "call",
      flowchartId,
      initialStack,
      returns: [
        {
          isTopLevel: true,
          innerStackIds: steps.map(
            (step) =>
              stepIdToStackIdForInside[
                callActionAnnotation(step.scene).returningStepId
              ],
          ),
          outerStack: stepsToViewchartStack(
            defs,
            flowchartId,
            frameId,
            steps,
            callStack,
            stepIdToStackId,
          ),
        },
      ],
      callDepth: callStack.length + 1,
    };
  }
}
