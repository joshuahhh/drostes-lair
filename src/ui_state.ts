import { Definitions } from "./interpreter";

export type UIState = {
  initialValue: unknown;
  initialFlowchartId: string;
  defs: Definitions;
};
