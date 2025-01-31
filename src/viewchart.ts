import { Definitions, Scene, Step } from "./interpreter";

// NOTE: right now viewchart stuff is runtime-only. if you try to
// serialize it, you will get a terrible exponentially-redundant
// mess. don't do that.

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
  steps: Step[];
  nextNodes: ViewchartNode[];
  someStepIsStuck: boolean;
  isFinal: boolean;
};

export type ViewchartStackGroup = {
  type: "stack-group";
  nextStacks: ViewchartStack[];
};

export type ViewchartCall = {
  type: "call";
  flowchartId: string;
  initialStack: ViewchartStack;
  returns: {
    innerStackIds: string[];
    outerStack: ViewchartStack;
    isTopLevel?: boolean;
  }[];
  callDepth: number;
};

export type ViewchartOptions = { showEmptyFrames?: boolean };

export type ViewchartSystem = {
  name: string;
  initialStepToViewchartStack(
    defs: Definitions,
    initialStep: Step,
    opts?: ViewchartOptions,
  ): ViewchartStack;
};
