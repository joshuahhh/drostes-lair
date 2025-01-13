import { Flowchart, success } from "./interpreter";
import { indexById } from "./util";

export const twoCallsInARowFlowcharts: Flowchart[] = [
  {
    id: "fc1",
    initialFrameId: "1",
    frames: indexById([
      { id: "1" },
      {
        id: "2",
        action: {
          type: "call",
          flowchartId: "fc2",
        },
      },
      {
        id: "3",
        action: {
          type: "call",
          flowchartId: "fc2",
        },
      },
    ]),
    arrows: [
      { from: "1", to: "2" },
      { from: "2", to: "3" },
    ],
  },
  {
    id: "fc2",
    initialFrameId: "1",
    frames: indexById([
      { id: "1" },
      {
        id: "2",
        action: {
          type: "test-func",
          func: ({ value: x }) => [success(x + 10)],
        },
      },
    ]),
    arrows: [{ from: "1", to: "2" }],
  },
];

export const branchingFlowchart: Flowchart[] = [
  {
    id: "fc1",
    initialFrameId: "1",
    frames: indexById([
      { id: "1" },
      {
        id: "2",
        action: {
          type: "test-func",
          func: ({ value: x }) => [
            success(x),
            success(x + 10),
            success(x + 20),
          ],
        },
      },
      {
        id: "3",
        action: {
          type: "call",
          flowchartId: "fc2",
        },
      },
    ]),
    arrows: [{ from: "1", to: "2" }],
  },
];
