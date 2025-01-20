import { Call, Definitions, Scene, Step } from "./interpreter";

export type StackedNode = StackedSteps | StackedCall;

export type StackedSteps = {
  type: "step";
  nodeId: string;
  frameId: string;
  flowchartId: string;
  scenes: Scene[];
  nextNodes: StackedNode[];
  isStuck: boolean;
};

export type StackedCall = {
  type: "call";
  nodeId: string;
  flowchartId: string;
  initialSteps: StackedSteps;

  exitSteps: StackedSteps;

  /* Redundant; included for visualization convenience */
  // callDepth: number;
};

export type StackedCallExits = {
  finalStepIds: string[];
  exitSteps: StackedSteps | "final-exit";
};

export function stackSteps(
  defs: Definitions,
  flowchartId: string,
  frameId: string,
  steps: Step[],
): StackedSteps {
  return {
    type: "step",
    nodeId: steps[0].id,
    frameId: steps[0].frameId,
    flowchartId: steps[0].flowchartId,
    scenes: steps.map((step) => step.scene),
    nextNodes: Object.values(nextNodesByFrameId).map((nextNodes) => {
      if (nextNodes[0].type === "step") {
        return stackSteps(nextNodes as Step[]);
      } else {
        return stackCalls(nextNodes as Call[]);
      }
    }),
    isStuck: steps.some((step) => step.isStuck),
  };
}

export function stackCalls(calls: Call[]): StackedCall {
  // ok we got a buncha calls that presumably all sit in the same place. let's stack em
  const initialSteps = stackSteps(calls.map((node) => node.initialStep));
  const exits = calls.flatMap((node) => node.exits);
  const exitSteps = stackSteps();
  return {
    type: "call",
    nodeId: calls[0].nodeId,
    flowchartId: calls[0].flowchartId,
    initialSteps,
    exitSteps,
  };
}
