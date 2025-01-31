import { expect, test } from "vitest";
import { runHelper, success } from "./test-utils";
import { indexById } from "./util";
import { Joined } from "./viewchart-joined";

test("Joined.initialStepToViewchartStack works with a very simple flowchart", () => {
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

  const stack = Joined.initialStepToViewchartStack(defs, initialStep);

  expect(stack).toMatchInlineSnapshot(`
    {
      "flowchartId": "fc1",
      "frameId": "1",
      "id": "[]/1",
      "isFinal": false,
      "nextNodes": [
        {
          "flowchartId": "fc1",
          "frameId": "2",
          "id": "[]/2",
          "isFinal": true,
          "nextNodes": [],
          "someStepIsStuck": false,
          "steps": [
            {
              "callStack": [],
              "flowchartId": "fc1",
              "frameId": "2",
              "id": "→1[0]→2[0]",
              "isStuck": false,
              "nextCalls": {},
              "nextSteps": {},
              "scene": {
                "type": "success",
                "value": 4,
              },
            },
          ],
          "type": "stack",
        },
      ],
      "someStepIsStuck": false,
      "steps": [
        {
          "callStack": [],
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "→1[0]",
          "isStuck": false,
          "nextCalls": {},
          "nextSteps": {
            "2": [
              {
                "callStack": [],
                "flowchartId": "fc1",
                "frameId": "2",
                "id": "→1[0]→2[0]",
                "isStuck": false,
                "nextCalls": {},
                "nextSteps": {},
                "scene": {
                  "type": "success",
                  "value": 4,
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
      ],
      "type": "stack",
    }
  `);
});

test("Joined.initialStepToViewchartStack works with a single call", () => {
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

  const stack = Joined.initialStepToViewchartStack(defs, initialStep);

  expect(stack).toMatchInlineSnapshot(`
    {
      "flowchartId": "fc1",
      "frameId": "1",
      "id": "[]/1",
      "isFinal": false,
      "nextNodes": [
        {
          "callDepth": 1,
          "exitStacks": {
            "→1[0]→2/→1[0]→2[0]": {
              "flowchartId": "fc1",
              "frameId": "2",
              "id": "[]/2",
              "isFinal": true,
              "nextNodes": [],
              "someStepIsStuck": false,
              "steps": [
                {
                  "callStack": [],
                  "flowchartId": "fc1",
                  "frameId": "2",
                  "id": "→1[0]→2[→1[0]→2/→1[0]→2[0]]",
                  "isStuck": false,
                  "nextCalls": {},
                  "nextSteps": {},
                  "scene": {
                    "actionAnnotation": {
                      "returningStepId": "→1[0]→2/→1[0]→2[0]",
                      "type": "call",
                    },
                    "type": "success",
                    "value": 13,
                  },
                },
              ],
              "type": "stack",
            },
          },
          "flowchartId": "fc1",
          "initialStack": {
            "flowchartId": "fc1",
            "frameId": "2",
            "id": "[{"framechartId":"fc1","frameId":"2"}]/2",
            "isFinal": false,
            "nextNodes": [],
            "someStepIsStuck": false,
            "steps": [
              {
                "callStack": [
                  {
                    "action": {
                      "flowchartId": "fc2",
                      "type": "call",
                    },
                    "callId": "→1[0]→2",
                    "scene": {
                      "actionAnnotation": undefined,
                      "type": "success",
                      "value": 3,
                    },
                  },
                ],
                "flowchartId": "fc2",
                "frameId": "1",
                "id": "→1[0]→2/→1[0]",
                "isStuck": false,
                "nextCalls": {},
                "nextSteps": {
                  "2": [
                    {
                      "callStack": [
                        {
                          "action": {
                            "flowchartId": "fc2",
                            "type": "call",
                          },
                          "callId": "→1[0]→2",
                          "scene": {
                            "actionAnnotation": undefined,
                            "type": "success",
                            "value": 3,
                          },
                        },
                      ],
                      "flowchartId": "fc2",
                      "frameId": "2",
                      "id": "→1[0]→2/→1[0]→2[0]",
                      "isStuck": false,
                      "nextCalls": {},
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
            ],
            "type": "stack",
          },
          "type": "call",
        },
      ],
      "someStepIsStuck": false,
      "steps": [
        {
          "callStack": [],
          "flowchartId": "fc1",
          "frameId": "1",
          "id": "→1[0]",
          "isStuck": false,
          "nextCalls": {
            "2": {
              "initialStep": {
                "callStack": [
                  {
                    "action": {
                      "flowchartId": "fc2",
                      "type": "call",
                    },
                    "callId": "→1[0]→2",
                    "scene": {
                      "actionAnnotation": undefined,
                      "type": "success",
                      "value": 3,
                    },
                  },
                ],
                "flowchartId": "fc2",
                "frameId": "1",
                "id": "→1[0]→2/→1[0]",
                "isStuck": false,
                "nextCalls": {},
                "nextSteps": {
                  "2": [
                    {
                      "callStack": [
                        {
                          "action": {
                            "flowchartId": "fc2",
                            "type": "call",
                          },
                          "callId": "→1[0]→2",
                          "scene": {
                            "actionAnnotation": undefined,
                            "type": "success",
                            "value": 3,
                          },
                        },
                      ],
                      "flowchartId": "fc2",
                      "frameId": "2",
                      "id": "→1[0]→2/→1[0]→2[0]",
                      "isStuck": false,
                      "nextCalls": {},
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
            },
          },
          "nextSteps": {
            "2": [
              {
                "callStack": [],
                "flowchartId": "fc1",
                "frameId": "2",
                "id": "→1[0]→2[→1[0]→2/→1[0]→2[0]]",
                "isStuck": false,
                "nextCalls": {},
                "nextSteps": {},
                "scene": {
                  "actionAnnotation": {
                    "returningStepId": "→1[0]→2/→1[0]→2[0]",
                    "type": "call",
                  },
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
      ],
      "type": "stack",
    }
  `);
});
