import { CallStack, Scene } from "./interpreter";

export type SceneWithId = Scene & { stepId: string };

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
  isFinal: boolean;
  callStack: CallStack;
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
