import { expect, test } from "vitest";
import { Flowchart, getFinalValues, runHelper } from "./interpreter";
import { indexById } from "./util";

test("runAll works with recursion (fibonacci!)", () => {
  // for this demo, we represent a domino grid as:
  //
  // { width: 4, height: 2, dominoes: [[[0, 0], [0, 1]], ...] }
  //
  // a domino-grid lens is [dx, dy]; it's assumed you're grabbing the
  // rest of the grid. (if we didn't assume this, we'd need to
  // express right-side intent as well.)

  const initialValue = {
    width: 4,
    height: 2,
    dominoes: [],
  };
  const flowchart: Flowchart = {
    id: "fc1",
    initialFrameId: "1",
    frames: indexById([
      { id: "1" },
      // we can place a vertical domino...
      {
        id: "one-domino-1",
        action: {
          type: "test-func",
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
  const { traceTree } = runHelper([flowchart], initialValue);
  const finalValues = getFinalValues(traceTree);
  expect(finalValues.length).toBe(5);
  expect(finalValues).toMatchInlineSnapshot(`
    [
      {
        "dominoes": [
          [
            [
              0,
              0,
            ],
            [
              0,
              1,
            ],
          ],
          [
            [
              1,
              0,
            ],
            [
              1,
              1,
            ],
          ],
          [
            [
              2,
              0,
            ],
            [
              2,
              1,
            ],
          ],
          [
            [
              3,
              0,
            ],
            [
              3,
              1,
            ],
          ],
        ],
        "height": 2,
        "width": 4,
      },
      {
        "dominoes": [
          [
            [
              0,
              0,
            ],
            [
              0,
              1,
            ],
          ],
          [
            [
              1,
              0,
            ],
            [
              1,
              1,
            ],
          ],
          [
            [
              2,
              0,
            ],
            [
              3,
              0,
            ],
          ],
          [
            [
              2,
              1,
            ],
            [
              3,
              1,
            ],
          ],
        ],
        "height": 2,
        "width": 4,
      },
      {
        "dominoes": [
          [
            [
              0,
              0,
            ],
            [
              0,
              1,
            ],
          ],
          [
            [
              1,
              0,
            ],
            [
              2,
              0,
            ],
          ],
          [
            [
              1,
              1,
            ],
            [
              2,
              1,
            ],
          ],
          [
            [
              3,
              0,
            ],
            [
              3,
              1,
            ],
          ],
        ],
        "height": 2,
        "width": 4,
      },
      {
        "dominoes": [
          [
            [
              0,
              0,
            ],
            [
              1,
              0,
            ],
          ],
          [
            [
              0,
              1,
            ],
            [
              1,
              1,
            ],
          ],
          [
            [
              2,
              0,
            ],
            [
              2,
              1,
            ],
          ],
          [
            [
              3,
              0,
            ],
            [
              3,
              1,
            ],
          ],
        ],
        "height": 2,
        "width": 4,
      },
      {
        "dominoes": [
          [
            [
              0,
              0,
            ],
            [
              1,
              0,
            ],
          ],
          [
            [
              0,
              1,
            ],
            [
              1,
              1,
            ],
          ],
          [
            [
              2,
              0,
            ],
            [
              3,
              0,
            ],
          ],
          [
            [
              2,
              1,
            ],
            [
              3,
              1,
            ],
          ],
        ],
        "height": 2,
        "width": 4,
      },
    ]
  `);
});
