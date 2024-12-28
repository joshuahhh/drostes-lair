import { expect, test } from "vitest";
import {
  Flowchart,
  Viewchart,
  putStepsInStacks,
  runHelper,
  scenesByFrame,
  stepsInStacksToViewchart,
  success,
} from "./interpreter";
import { twoCallsInARowFlowcharts } from "./interpreter.ex";
import { indexById } from "./util";

test("runAll works with a simple flowchart", () => {
  const { traceTree, flowchart } = runHelper(
    [
      {
        id: "fc1",
        initialFrameId: "1",
        frames: indexById([
          { id: "1" },
          {
            id: "2",
            action: {
              type: "test-func",
              func: ({ value: x }) => [success(x + 1)],
            },
          },
        ]),
        arrows: [{ from: "1", to: "2" }],
      },
    ],
    3,
  );
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "finalStepIds": [
        "*→2",
      ],
      "steps": {
        "*": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*",
          "prevStepId": undefined,
          "scene": {
            "type": "success",
            "value": 3,
          },
        },
        "*→2": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2",
          "prevStepId": "*",
          "scene": {
            "type": "success",
            "value": 4,
          },
        },
      },
    }
  `);
  expect(scenesByFrame(flowchart, traceTree)).toMatchInlineSnapshot(`
    {
      "1": [
        {
          "type": "success",
          "value": 3,
        },
      ],
      "2": [
        {
          "type": "success",
          "value": 4,
        },
      ],
    }
  `);
});

test("runAll works with NFA split & merge", () => {
  const { traceTree, flowchart } = runHelper(
    [
      {
        id: "fc1",
        initialFrameId: "1",
        frames: indexById([
          { id: "1" },
          {
            id: "2",
            action: {
              type: "test-func",
              func: ({ value: [x, y] }) => [success(x + y)],
            },
          },
          {
            id: "3",
            action: {
              type: "test-func",
              func: ({ value: [x, y] }) => [success(x * y)],
            },
          },
          {
            id: "4",
            action: {
              type: "test-func",
              func: ({ value: x }) => [success(x + 1)],
            },
          },
        ]),
        arrows: [
          { from: "1", to: "2" },
          { from: "1", to: "3" },
          { from: "2", to: "4" },
          { from: "3", to: "4" },
        ],
      },
    ],
    [3, 4],
  );
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "finalStepIds": [
        "*→2→4",
        "*→3→4",
      ],
      "steps": {
        "*": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*",
          "prevStepId": undefined,
          "scene": {
            "type": "success",
            "value": [
              3,
              4,
            ],
          },
        },
        "*→2": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2",
          "prevStepId": "*",
          "scene": {
            "type": "success",
            "value": 7,
          },
        },
        "*→2→4": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "4",
          "id": "*→2→4",
          "prevStepId": "*→2",
          "scene": {
            "type": "success",
            "value": 8,
          },
        },
        "*→3": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "3",
          "id": "*→3",
          "prevStepId": "*",
          "scene": {
            "type": "success",
            "value": 12,
          },
        },
        "*→3→4": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "4",
          "id": "*→3→4",
          "prevStepId": "*→3",
          "scene": {
            "type": "success",
            "value": 13,
          },
        },
      },
    }
  `);
  expect(scenesByFrame(flowchart, traceTree)).toMatchInlineSnapshot(`
    {
      "1": [
        {
          "type": "success",
          "value": [
            3,
            4,
          ],
        },
      ],
      "2": [
        {
          "type": "success",
          "value": 7,
        },
      ],
      "3": [
        {
          "type": "success",
          "value": 12,
        },
      ],
      "4": [
        {
          "type": "success",
          "value": 8,
        },
        {
          "type": "success",
          "value": 13,
        },
      ],
    }
  `);
});

test("runAll works with SIMD split & merge", () => {
  const { traceTree, flowchart } = runHelper(
    [
      {
        id: "fc1",
        initialFrameId: "1",
        frames: indexById([
          { id: "1" },
          {
            id: "2",
            action: {
              type: "test-func",
              func: ({ value: [x, y] }) => [success(x + y), success(x * y)],
            },
          },
          {
            id: "3",
            action: {
              type: "test-func",
              func: ({ value: x }) => [success(x + 1)],
            },
          },
        ]),
        arrows: [
          { from: "1", to: "2" },
          { from: "2", to: "3" },
        ],
      },
    ],
    [3, 4],
  );
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "finalStepIds": [
        "*→2[0]→3",
        "*→2[1]→3",
      ],
      "steps": {
        "*": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*",
          "prevStepId": undefined,
          "scene": {
            "type": "success",
            "value": [
              3,
              4,
            ],
          },
        },
        "*→2[0]": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2[0]",
          "prevStepId": "*",
          "scene": {
            "type": "success",
            "value": 7,
          },
        },
        "*→2[0]→3": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "3",
          "id": "*→2[0]→3",
          "prevStepId": "*→2[0]",
          "scene": {
            "type": "success",
            "value": 8,
          },
        },
        "*→2[1]": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2[1]",
          "prevStepId": "*",
          "scene": {
            "type": "success",
            "value": 12,
          },
        },
        "*→2[1]→3": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "3",
          "id": "*→2[1]→3",
          "prevStepId": "*→2[1]",
          "scene": {
            "type": "success",
            "value": 13,
          },
        },
      },
    }
  `);
  expect(scenesByFrame(flowchart, traceTree)).toMatchInlineSnapshot(`
    {
      "1": [
        {
          "type": "success",
          "value": [
            3,
            4,
          ],
        },
      ],
      "2": [
        {
          "type": "success",
          "value": 7,
        },
        {
          "type": "success",
          "value": 12,
        },
      ],
      "3": [
        {
          "type": "success",
          "value": 8,
        },
        {
          "type": "success",
          "value": 13,
        },
      ],
    }
  `);
});

test("runAll works with a single call", () => {
  const { traceTree, flowchart } = runHelper(
    [
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
        ]),
        arrows: [{ from: "1", to: "2" }],
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
    ],
    3,
  );
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "finalStepIds": [
        "*→2↓fc2→2↑fc1→2",
      ],
      "steps": {
        "*": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*",
          "prevStepId": undefined,
          "scene": {
            "type": "success",
            "value": 3,
          },
        },
        "*→2↓fc2": {
          "caller": {
            "frameId": "2",
            "prevStepId": "*",
          },
          "flowchartId": "fc2",
          "frameId": "1",
          "id": "*→2↓fc2",
          "prevStepId": "*",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": 3,
          },
        },
        "*→2↓fc2→2": {
          "caller": {
            "frameId": "2",
            "prevStepId": "*",
          },
          "flowchartId": "fc2",
          "frameId": "2",
          "id": "*→2↓fc2→2",
          "prevStepId": "*→2↓fc2",
          "scene": {
            "type": "success",
            "value": 13,
          },
        },
        "*→2↓fc2→2↑fc1→2": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2↓fc2→2↑fc1→2",
          "prevStepId": "*→2↓fc2→2",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": 13,
          },
        },
      },
    }
  `);
  expect(scenesByFrame(flowchart, traceTree)).toMatchInlineSnapshot(`
    {
      "1": [
        {
          "type": "success",
          "value": 3,
        },
      ],
      "2": [
        {
          "actionAnnotation": undefined,
          "type": "success",
          "value": 13,
        },
      ],
    }
  `);
});

test("runAll works with two calls in a row", () => {
  const { traceTree, flowchart } = runHelper(twoCallsInARowFlowcharts, 3);
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "finalStepIds": [
        "*→2↓fc2→2↑fc1→2→3↓fc2→2↑fc1→3",
      ],
      "steps": {
        "*": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*",
          "prevStepId": undefined,
          "scene": {
            "type": "success",
            "value": 3,
          },
        },
        "*→2↓fc2": {
          "caller": {
            "frameId": "2",
            "prevStepId": "*",
          },
          "flowchartId": "fc2",
          "frameId": "1",
          "id": "*→2↓fc2",
          "prevStepId": "*",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": 3,
          },
        },
        "*→2↓fc2→2": {
          "caller": {
            "frameId": "2",
            "prevStepId": "*",
          },
          "flowchartId": "fc2",
          "frameId": "2",
          "id": "*→2↓fc2→2",
          "prevStepId": "*→2↓fc2",
          "scene": {
            "type": "success",
            "value": 13,
          },
        },
        "*→2↓fc2→2↑fc1→2": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2↓fc2→2↑fc1→2",
          "prevStepId": "*→2↓fc2→2",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": 13,
          },
        },
        "*→2↓fc2→2↑fc1→2→3↓fc2": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2↓fc2→2↑fc1→2",
          },
          "flowchartId": "fc2",
          "frameId": "1",
          "id": "*→2↓fc2→2↑fc1→2→3↓fc2",
          "prevStepId": "*→2↓fc2→2↑fc1→2",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": 13,
          },
        },
        "*→2↓fc2→2↑fc1→2→3↓fc2→2": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2↓fc2→2↑fc1→2",
          },
          "flowchartId": "fc2",
          "frameId": "2",
          "id": "*→2↓fc2→2↑fc1→2→3↓fc2→2",
          "prevStepId": "*→2↓fc2→2↑fc1→2→3↓fc2",
          "scene": {
            "type": "success",
            "value": 23,
          },
        },
        "*→2↓fc2→2↑fc1→2→3↓fc2→2↑fc1→3": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "3",
          "id": "*→2↓fc2→2↑fc1→2→3↓fc2→2↑fc1→3",
          "prevStepId": "*→2↓fc2→2↑fc1→2→3↓fc2→2",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": 23,
          },
        },
      },
    }
  `);
  expect(scenesByFrame(flowchart, traceTree)).toMatchInlineSnapshot(`
    {
      "1": [
        {
          "type": "success",
          "value": 3,
        },
      ],
      "2": [
        {
          "actionAnnotation": undefined,
          "type": "success",
          "value": 13,
        },
      ],
      "3": [
        {
          "actionAnnotation": undefined,
          "type": "success",
          "value": 23,
        },
      ],
    }
  `);
});

test("runAll works with test-cond", () => {
  const flowchart: Flowchart = {
    id: "fc1",
    initialFrameId: "1",
    frames: indexById([
      { id: "1" },
      {
        id: "2",
        action: {
          type: "test-cond",
          func: ({ value: x }) => x > 0,
          then: {
            type: "test-func",
            func: ({ value: x }) => [success(x + 1)],
          },
          else: {
            type: "test-func",
            func: ({ value: x }) => [success(x - 1)],
          },
        },
      },
    ]),
    arrows: [{ from: "1", to: "2" }],
  };
  const { traceTree: traceTreePos } = runHelper([flowchart], 3);
  expect(traceTreePos).toMatchInlineSnapshot(`
    {
      "finalStepIds": [
        "*→2",
      ],
      "steps": {
        "*": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*",
          "prevStepId": undefined,
          "scene": {
            "type": "success",
            "value": 3,
          },
        },
        "*→2": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2",
          "prevStepId": "*",
          "scene": {
            "type": "success",
            "value": 4,
          },
        },
      },
    }
  `);
  const { traceTree: traceTreeNeg } = runHelper([flowchart], -3);
  expect(traceTreeNeg).toMatchInlineSnapshot(`
    {
      "finalStepIds": [
        "*→2",
      ],
      "steps": {
        "*": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*",
          "prevStepId": undefined,
          "scene": {
            "type": "success",
            "value": -3,
          },
        },
        "*→2": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2",
          "prevStepId": "*",
          "scene": {
            "type": "success",
            "value": -4,
          },
        },
      },
    }
  `);
});

test("stepsInStacksToViewchart works with two calls in a row", () => {
  const { traceTree } = runHelper(twoCallsInARowFlowcharts, 3);
  const stepsInStacks = putStepsInStacks(traceTree);
  const viewchart = stepsInStacksToViewchart(stepsInStacks);
  expect(viewchart).toMatchInlineSnapshot(`
    {
      "callPath": [],
      "callViewchartsByFrameId": {
        "2": {
          "callPath": [
            {
              "flowchartId": "fc1",
              "frameId": "2",
            },
          ],
          "callViewchartsByFrameId": {},
          "flowchartId": "fc2",
          "stackByFrameId": {
            "1": {
              "stackPath": {
                "callPath": [
                  {
                    "flowchartId": "fc1",
                    "frameId": "2",
                  },
                ],
                "final": {
                  "flowchartId": "fc2",
                  "frameId": "1",
                },
              },
              "stepIds": [
                "*→2↓fc2",
              ],
            },
            "2": {
              "stackPath": {
                "callPath": [
                  {
                    "flowchartId": "fc1",
                    "frameId": "2",
                  },
                ],
                "final": {
                  "flowchartId": "fc2",
                  "frameId": "2",
                },
              },
              "stepIds": [
                "*→2↓fc2→2",
              ],
            },
          },
        },
        "3": {
          "callPath": [
            {
              "flowchartId": "fc1",
              "frameId": "3",
            },
          ],
          "callViewchartsByFrameId": {},
          "flowchartId": "fc2",
          "stackByFrameId": {
            "1": {
              "stackPath": {
                "callPath": [
                  {
                    "flowchartId": "fc1",
                    "frameId": "3",
                  },
                ],
                "final": {
                  "flowchartId": "fc2",
                  "frameId": "1",
                },
              },
              "stepIds": [
                "*→2↓fc2→2↑fc1→2→3↓fc2",
              ],
            },
            "2": {
              "stackPath": {
                "callPath": [
                  {
                    "flowchartId": "fc1",
                    "frameId": "3",
                  },
                ],
                "final": {
                  "flowchartId": "fc2",
                  "frameId": "2",
                },
              },
              "stepIds": [
                "*→2↓fc2→2↑fc1→2→3↓fc2→2",
              ],
            },
          },
        },
      },
      "flowchartId": "fc1",
      "stackByFrameId": {
        "1": {
          "stackPath": {
            "callPath": [],
            "final": {
              "flowchartId": "fc1",
              "frameId": "1",
            },
          },
          "stepIds": [
            "*",
          ],
        },
        "2": {
          "stackPath": {
            "callPath": [],
            "final": {
              "flowchartId": "fc1",
              "frameId": "2",
            },
          },
          "stepIds": [
            "*→2↓fc2→2↑fc1→2",
          ],
        },
        "3": {
          "stackPath": {
            "callPath": [],
            "final": {
              "flowchartId": "fc1",
              "frameId": "3",
            },
          },
          "stepIds": [
            "*→2↓fc2→2↑fc1→2→3↓fc2→2↑fc1→3",
          ],
        },
      },
    }
  `);
  function countStacks(viewchart: Viewchart) {
    let count = Object.values(viewchart.stackByFrameId).length;
    for (const frameId in viewchart.callViewchartsByFrameId) {
      count += countStacks(viewchart.callViewchartsByFrameId[frameId]);
    }
    return count;
  }
  // this works cuz there's no ambing
  expect(countStacks(viewchart)).toBe(Object.values(traceTree.steps).length);
});
