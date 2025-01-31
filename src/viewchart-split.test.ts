import { expect, test } from "vitest";
import { runHelper, success } from "./test-utils";
import { indexById } from "./util";
import { Split } from "./viewchart-split";

test("Split.initialStepToViewchartStack works with a very simple flowchart", () => {
  const { initialStep, defs } = runHelper(
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
              func: (x) => [success(x + 1)],
            },
          },
        ]),
        arrows: [{ from: "1", to: "2" }],
      },
    ],
    3,
  );

  const stack = Split.initialStepToViewchartStack(defs, initialStep);

  expect(stack).toMatchInlineSnapshot(`
    {
      "flowchartId": "fc1",
      "frameId": "1",
      "id": "→1[0]",
      "nextNodes": [
        {
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "→1[0]→2[0]",
          "nextNodes": [],
          "scenes": [
            {
              "stepId": "→1[0]→2[0]",
              "type": "success",
              "value": 4,
            },
          ],
          "someStepIsStuck": false,
          "type": "stack",
        },
      ],
      "scenes": [
        {
          "actionAnnotation": undefined,
          "stepId": "→1[0]",
          "type": "success",
          "value": 3,
        },
      ],
      "someStepIsStuck": false,
      "type": "stack",
    }
  `);
});

test("Split.initialStepToViewchartStack works with a single call", () => {
  const { initialStep, defs } = runHelper(
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
              func: (x) => [success(x + 10)],
            },
          },
        ]),
        arrows: [{ from: "1", to: "2" }],
      },
    ],
    3,
  );

  const stack = Split.initialStepToViewchartStack(defs, initialStep);

  expect(stack).toMatchInlineSnapshot(`
    {
      "flowchartId": "fc1",
      "frameId": "1",
      "id": "→1[0]",
      "nextNodes": [
        {
          "exitStacks": {
            "→1[0]/→1[0]→2[0]": {
              "flowchartId": "fc1",
              "frameId": "2",
              "id": "→1[0]→2[0]",
              "nextNodes": [],
              "scenes": [
                {
                  "actionAnnotation": {
                    "initialStep": {
                      "flowchartId": "fc2",
                      "frameId": "1",
                      "id": "→1[0]/→1[0]",
                      "isStuck": false,
                      "nextSteps": {
                        "2": [
                          {
                            "flowchartId": "fc2",
                            "frameId": "2",
                            "id": "→1[0]/→1[0]→2[0]",
                            "isStuck": false,
                            "nextSteps": {},
                            "scene": {
                              "type": "success",
                              "value": 13,
                            },
                          },
                        ],
                      },
                      "scene": {
                        "actionAnnotation": undefined,
                        "type": "success",
                        "value": 3,
                      },
                    },
                    "returningStepId": "→1[0]/→1[0]→2[0]",
                    "type": "call",
                  },
                  "stepId": "→1[0]→2[0]",
                  "type": "success",
                  "value": 13,
                },
              ],
              "someStepIsStuck": false,
              "type": "stack",
            },
          },
          "flowchartId": "fc1",
          "initialStack": {
            "flowchartId": "fc2",
            "frameId": "1",
            "id": "→1[0]/→1[0]",
            "nextNodes": [
              {
                "flowchartId": "fc2",
                "frameId": "2",
                "id": "→1[0]/→1[0]→2[0]",
                "nextNodes": [],
                "scenes": [
                  {
                    "stepId": "→1[0]/→1[0]→2[0]",
                    "type": "success",
                    "value": 13,
                  },
                ],
                "someStepIsStuck": false,
                "type": "stack",
              },
            ],
            "scenes": [
              {
                "actionAnnotation": undefined,
                "stepId": "→1[0]/→1[0]",
                "type": "success",
                "value": 3,
              },
            ],
            "someStepIsStuck": false,
            "type": "stack",
          },
          "type": "call",
        },
      ],
      "scenes": [
        {
          "actionAnnotation": undefined,
          "stepId": "→1[0]",
          "type": "success",
          "value": 3,
        },
      ],
      "someStepIsStuck": false,
      "type": "stack",
    }
  `);
});
