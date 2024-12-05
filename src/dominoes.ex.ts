import { Flowchart, Frame } from "./interpreter";
import { indexById } from "./util";

export const dominoFlowchart: Flowchart = {
  id: "♌︎",
  initialFrameId: "1",
  frames: indexById<Frame>([
    { id: "1", action: { type: "start" }, escapeRouteFrameId: "base-case" },
    // we can place a vertical domino...
    {
      id: "one-domino-1",
      action: {
        type: "place-domino",
        domino: [
          [0, 0],
          [0, 1],
        ],
      },
    },
    // ...and recurse
    {
      id: "one-domino-2",
      action: {
        type: "call",
        flowchartId: "♌︎",
        lens: {
          type: "domino-grid",
          dx: 1,
          dy: 0,
        },
      },
    },
    // alternatively, we can place two horizontal dominoes...
    {
      id: "two-dominoes-1",
      action: {
        type: "place-domino",
        domino: [
          [0, 0],
          [1, 0],
        ],
      },
    },
    {
      id: "two-dominoes-1b",
      action: {
        type: "place-domino",
        domino: [
          [0, 1],
          [1, 1],
        ],
      },
    },
    // ...and recurse
    {
      id: "two-dominoes-2",
      action: {
        type: "call",
        flowchartId: "♌︎",
        lens: {
          type: "domino-grid",
          dx: 2,
          dy: 0,
        },
      },
    },
    // and here's where we go if things don't work out
    {
      id: "base-case",
    },
  ]),
  arrows: [
    { from: "1", to: "one-domino-1" },
    { from: "one-domino-1", to: "one-domino-2" },
    { from: "1", to: "two-dominoes-1" },
    { from: "two-dominoes-1", to: "two-dominoes-1b" },
    { from: "two-dominoes-1b", to: "two-dominoes-2" },
  ],
};
