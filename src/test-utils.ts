import {
  Definitions,
  Flowchart,
  RunContext,
  Scene,
  SuccessfulStep,
  runFlowchart,
} from "./interpreter";
import { indexById } from "./util";

/**
 * Convenience function to run a flowchart in a typical situation.
 */
export function runHelper(flowcharts: Flowchart[], value: any) {
  const defs: Definitions = { flowcharts: indexById(flowcharts) };
  const ctx: RunContext = { defs, callStack: [] };
  return {
    ...runFlowchart(ctx, flowcharts[0].id, { type: "success", value }),
    defs,
  };
}

export function exitingValues(steps: SuccessfulStep[]) {
  return steps.map((step) => step.scene.value);
}

export function success(
  value: any,
  key: string = "0",
): { scene: Scene; key: string } {
  return { scene: { type: "success", value }, key };
}
