import { Definitions, Step, getNextFrameIds } from "./interpreter";
import { ViewchartNode, ViewchartStack } from "./viewchart";

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
  ): ViewchartStack {
    const nextFrameIds = getNextFrameIds(defs, { flowchartId, frameId });
    return {
      type: "stack",
      id: stringifyJoinedCallStack(callStack) + "/" + frameId,
      frameId: frameId,
      flowchartId: flowchartId,
      steps,
      nextNodes: nextFrameIds.flatMap((nextFrameId) => {
        const nextSteps = steps.flatMap(
          (step) => step.nextSteps[nextFrameId] || [],
        );
        const nextCalls = steps.flatMap(
          (step) => step.nextCalls[nextFrameId] || [],
        );
        if (nextCalls.length === 0) {
          return [
            stepsToViewchartStack(
              defs,
              flowchartId,
              nextFrameId,
              nextSteps,
              callStack,
            ),
          ];
        } else {
          // we assume that all nextSteps are returns from the
          // nextCalls
          return [
            callsToViewchartCall(
              defs,
              flowchartId,
              nextFrameId,
              nextSteps,
              nextCalls,
              callStack,
            ),
          ];
        }
      }),
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
  ): ViewchartNode {
    return {
      type: "call",
      flowchartId,
      initialStack: stepsToViewchartStack(
        defs,
        calls[0].initialStep.flowchartId,
        calls[0].initialStep.frameId,
        calls.map((call) => call.initialStep),
        [...callStack, { framechartId: flowchartId, frameId }],
      ),
      exitStacks: {
        top: stepsToViewchartStack(
          defs,
          flowchartId,
          frameId,
          steps,
          callStack,
        ),
      },
      // mapValues(
      //   groupBy(
      //     steps,
      //     (step) => callActionAnnotation(step.scene).returningStepId,
      //   ),
      //   (steps) =>
      //     stepsToViewchartStack(defs, flowchartId, frameId, steps, callStack),
      // ),
      callDepth: callStack.length + 1,
    };
  }
}
