import { expect, test } from "vitest";
import { Flowchart, runHelper, success } from "./interpreter";
import { indexById } from "./util";

test("runAll works with recursion (gcd!)", () => {
  const flowchart: Flowchart = {
    id: "fc1",
    initialFrameId: "1",
    frames: indexById([
      { id: "1" },
      {
        id: "2",
        action: {
          type: "test-cond",
          func: ({ value: [a, b] }) => a < b,
          then: {
            type: "test-func",
            func: ({ value: [a, b] }) => [success([a, b - a])],
          },
          else: {
            type: "test-func",
            func: ({ value: [a, b] }) => [success([a - b, b])],
          },
        },
      },
      {
        id: "3",
        action: {
          type: "test-cond",
          func: ({ value: [a, b] }) => a === 0 || b === 0,
          then: undefined,
          else: {
            type: "call",
            flowchartId: "fc1",
          },
        },
      },
    ]),
    arrows: [
      { from: "1", to: "2" },
      { from: "2", to: "3" },
    ],
  };
  const { traceTree } = runHelper([flowchart], [252, 105]);
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "finalStepIds": [
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3↑fc1→3↑fc1→3↑fc1→3",
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
              252,
              105,
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
            "value": [
              147,
              105,
            ],
          },
        },
        "*→2→3↓fc1": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2",
          },
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*→2→3↓fc1",
          "prevStepId": "*→2",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": [
              147,
              105,
            ],
          },
        },
        "*→2→3↓fc1→2": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2",
          },
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2→3↓fc1→2",
          "prevStepId": "*→2→3↓fc1",
          "scene": {
            "type": "success",
            "value": [
              42,
              105,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*→2→3↓fc1→2→3↓fc1",
          "prevStepId": "*→2→3↓fc1→2",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": [
              42,
              105,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2→3↓fc1→2→3↓fc1→2",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1",
          "scene": {
            "type": "success",
            "value": [
              42,
              63,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": [
              42,
              63,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1",
          "scene": {
            "type": "success",
            "value": [
              42,
              21,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": [
              42,
              21,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1",
          "scene": {
            "type": "success",
            "value": [
              21,
              21,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": [
              21,
              21,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1",
          "scene": {
            "type": "success",
            "value": [
              0,
              21,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "3",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": [
              0,
              21,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "3",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": [
              0,
              21,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "3",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": [
              0,
              21,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3↑fc1→3": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2→3↓fc1→2",
          },
          "flowchartId": "fc1",
          "frameId": "3",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3↑fc1→3",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": [
              0,
              21,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3↑fc1→3↑fc1→3": {
          "caller": {
            "frameId": "3",
            "prevStepId": "*→2",
          },
          "flowchartId": "fc1",
          "frameId": "3",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3↑fc1→3↑fc1→3",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3↑fc1→3",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": [
              0,
              21,
            ],
          },
        },
        "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3↑fc1→3↑fc1→3↑fc1→3": {
          "caller": undefined,
          "flowchartId": "fc1",
          "frameId": "3",
          "id": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3↑fc1→3↑fc1→3↑fc1→3",
          "prevStepId": "*→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↓fc1→2→3↑fc1→3↑fc1→3↑fc1→3↑fc1→3",
          "scene": {
            "actionAnnotation": undefined,
            "type": "success",
            "value": [
              0,
              21,
            ],
          },
        },
      },
    }
  `);
});
