import { assert, expect, test } from "vitest";
import { dominoFlowchart } from "./dominoes.ex";
import {
  callPath,
  getFinalValues,
  runHelper,
  topLevelValueForStep,
} from "./interpreter";

test("runAll works with recursion (dominoes!)", () => {
  const initialValue = {
    width: 4,
    height: 2,
    dominoes: [],
  };
  const { traceTree } = runHelper([dominoFlowchart], initialValue);
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

test("framePathForStep & topLevelValueForStep work", () => {
  const initialValue = {
    width: 4,
    height: 2,
    dominoes: [],
  };
  const { traceTree, defs } = runHelper([dominoFlowchart], initialValue);
  const someStep =
    traceTree.steps[
      "*→one-domino-1→one-domino-2↓♌︎→one-domino-1→one-domino-2↓♌︎→one-domino-1"
    ];

  expect(callPath(someStep, traceTree, "stacked")).toEqual({
    callPath: [
      {
        flowchartId: "♌︎",
        frameId: "one-domino-2",
      },
      {
        flowchartId: "♌︎",
        frameId: "one-domino-2",
      },
    ],
    final: {
      flowchartId: "♌︎",
      frameId: "one-domino-1",
    },
  });

  // at this point, we've placed one domino in the 2x2 sub-grid:
  assert(someStep.scene.type === "success");
  expect(someStep.scene.value).toMatchInlineSnapshot(`
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
      ],
      "height": 2,
      "width": 2,
    }
  `);

  // the "top-level value" is on the full 2x4 grid and has three
  // dominos (from two higher call levels):
  const topLevelValue = topLevelValueForStep(
    someStep,
    someStep.scene.value,
    traceTree,
    defs,
  );
  expect(topLevelValue).toMatchInlineSnapshot(`
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
      ],
      "height": 2,
      "width": 4,
    }
  `);
});
