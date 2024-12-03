import { Flowchart } from "./interpreter";
import { indexById } from "./util";

export const dominoFlowchart: Flowchart = {
  id: "fc1",
  initialFrameId: "1",
  frames: indexById([
    { id: "1" },
    // we can place a vertical domino...
    {
      id: "one-domino-1",
      action: {
        type: "test-func",
        label: "place vert. domino",
        func: ({ value }) => {
          if (value.width < 1) {
            throw new Error("width must be at least 1");
          }
          return [
            {
              value: {
                ...value,
                dominoes: [
                  ...value.dominoes,
                  [
                    [0, 0],
                    [0, 1],
                  ],
                ],
              },
            },
          ];
        },
        failureFrameId: "base-case",
      },
    },
    // ...and recurse
    {
      id: "one-domino-2",
      action: {
        type: "call",
        flowchartId: "fc1",
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
        type: "test-func",
        label: "place 2 hor. dominos",
        func: ({ value }) => {
          if (value.width < 2) {
            throw new Error("width must be at least 2");
          }
          return [
            {
              value: {
                ...value,
                dominoes: [
                  ...value.dominoes,
                  [
                    [0, 0],
                    [1, 0],
                  ],
                  [
                    [0, 1],
                    [1, 1],
                  ],
                ],
              },
            },
          ];
        },
      },
    },
    // ...and recurse
    {
      id: "two-dominoes-2",
      action: {
        type: "call",
        flowchartId: "fc1",
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
    { from: "two-dominoes-1", to: "two-dominoes-2" },
  ],
};
