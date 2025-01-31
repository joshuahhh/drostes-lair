import {
  Definitions,
  Step,
  callActionAnnotation,
  getNextFrameIds,
} from "./interpreter";
import { truthy } from "./util";
import { ViewchartNode, ViewchartOptions, ViewchartStack } from "./viewchart";

export namespace Split {
  export const name = "split";

  type Context = {
    defs: Definitions;
    showEmptyFrames: boolean;
  };

  export function initialStepToViewchartStack(
    defs: Definitions,
    initialStep: Step,
    opts: ViewchartOptions = {},
  ) {
    return stepToViewchartStack(
      {
        defs,
        showEmptyFrames: opts.showEmptyFrames ?? false,
      },
      initialStep,
      0,
    );
  }

  function stepToViewchartStack(
    ctx: Context,
    step: Step,
    callDepth: number,
  ): ViewchartStack {
    const nextFrameIds = getNextFrameIds(ctx.defs, step);
    return {
      type: "stack",
      id: step.id,
      frameId: step.frameId,
      flowchartId: step.flowchartId,
      steps: [step],
      nextNodes: nextFrameIds
        .map((nextFrameId) => {
          const nextSteps = step.nextSteps[nextFrameId];
          if (nextSteps === undefined) {
            if (ctx.showEmptyFrames) {
              return emptyViewchartStack(ctx, step, nextFrameId);
            } else {
              return undefined;
            }
          } else {
            return stepsOnFrameToViewchartNode(
              ctx,
              nextSteps,
              step.nextCalls[nextFrameId],
              callDepth,
            );
          }
        })
        .filter(truthy),
      someStepIsStuck: step.isStuck,
      isFinal: callDepth === 0 && Object.values(step.nextSteps).length === 0,
    };
  }

  function stepsOnFrameToViewchartNode(
    ctx: Context,
    steps: Step[],
    maybeCall: { initialStep: Step } | undefined,
    callDepth: number,
  ): ViewchartNode {
    if (maybeCall) {
      return {
        type: "call",
        flowchartId: maybeCall.initialStep.flowchartId,
        initialStack: stepToViewchartStack(
          ctx,
          maybeCall.initialStep,
          callDepth + 1,
        ) as ViewchartStack,
        returns: steps.map((step) => ({
          innerStackIds: [callActionAnnotation(step.scene).returningStepId],
          outerStack: stepToViewchartStack(ctx, step, callDepth),
        })),
        callDepth: callDepth + 1,
      };
    } else {
      if (steps.length === 1) {
        return stepToViewchartStack(ctx, steps[0], callDepth);
      } else {
        return {
          type: "stack-group",
          nextStacks: steps.map((step) =>
            stepToViewchartStack(ctx, step, callDepth),
          ),
        };
      }
    }
  }

  function emptyViewchartStack(
    ctx: Context,
    originalStep: Step,
    frameId: string,
  ): ViewchartStack {
    const { flowchartId } = originalStep;
    const nextFrameIds = getNextFrameIds(ctx.defs, { flowchartId, frameId });
    return {
      type: "stack",
      id: originalStep.id + "-empty-" + frameId,
      flowchartId,
      frameId,
      steps: [],
      nextNodes: nextFrameIds.map((nextFrameId) =>
        emptyViewchartStack(ctx, originalStep, nextFrameId),
      ),
      someStepIsStuck: false,
      isFinal: false,
    };
  }
}
