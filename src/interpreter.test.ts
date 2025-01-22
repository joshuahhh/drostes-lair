import { expect, test } from "vitest";
import { Flowchart } from "./interpreter";
import { twoCallsInARowFlowcharts } from "./interpreter.ex";
import { exitingValues, runHelper, success } from "./test-utils";
import { indexById } from "./util";

test("runFlowchart works with a very simple flowchart", () => {
  const { initialStep, exitingSteps } = runHelper(
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

  expect(initialStep).toMatchInlineSnapshot(`
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
    }
  `);

  expect(exitingValues(exitingSteps)).toEqual([4]);
});

test("runFlowchart works with NFA split & merge", () => {
  const { initialStep, exitingSteps } = runHelper(
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
              func: ([x, y]) => [success(x + y)],
            },
          },
          {
            id: "3",
            action: {
              type: "test-func",
              func: ([x, y]) => [success(x * y)],
            },
          },
          {
            id: "4",
            action: {
              type: "test-func",
              func: (x) => [success(x + 1)],
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
  expect(initialStep).toMatchInlineSnapshot(`
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
            "nextSteps": {
              "4": [
                {
                  "callStack": [],
                  "flowchartId": "fc1",
                  "frameId": "4",
                  "id": "→1[0]→2[0]→4[0]",
                  "isStuck": false,
                  "nextCalls": {},
                  "nextSteps": {},
                  "scene": {
                    "type": "success",
                    "value": 8,
                  },
                },
              ],
            },
            "scene": {
              "type": "success",
              "value": 7,
            },
          },
        ],
        "3": [
          {
            "callStack": [],
            "flowchartId": "fc1",
            "frameId": "3",
            "id": "→1[0]→3[0]",
            "isStuck": false,
            "nextCalls": {},
            "nextSteps": {
              "4": [
                {
                  "callStack": [],
                  "flowchartId": "fc1",
                  "frameId": "4",
                  "id": "→1[0]→3[0]→4[0]",
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
              "type": "success",
              "value": 12,
            },
          },
        ],
      },
      "scene": {
        "actionAnnotation": undefined,
        "type": "success",
        "value": [
          3,
          4,
        ],
      },
    }
  `);

  expect(exitingValues(exitingSteps)).toEqual([8, 13]);
});

test("runFlowchart works with SIMD split & merge", () => {
  const { initialStep, exitingSteps } = runHelper(
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
              func: ([x, y]) => [success(x + y, "0"), success(x * y, "1")],
            },
          },
          {
            id: "3",
            action: {
              type: "test-func",
              func: (x) => [success(x + 1)],
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

  expect(initialStep).toMatchInlineSnapshot(`
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
            "nextSteps": {
              "3": [
                {
                  "callStack": [],
                  "flowchartId": "fc1",
                  "frameId": "3",
                  "id": "→1[0]→2[0]→3[0]",
                  "isStuck": false,
                  "nextCalls": {},
                  "nextSteps": {},
                  "scene": {
                    "type": "success",
                    "value": 8,
                  },
                },
              ],
            },
            "scene": {
              "type": "success",
              "value": 7,
            },
          },
          {
            "callStack": [],
            "flowchartId": "fc1",
            "frameId": "2",
            "id": "→1[0]→2[1]",
            "isStuck": false,
            "nextCalls": {},
            "nextSteps": {
              "3": [
                {
                  "callStack": [],
                  "flowchartId": "fc1",
                  "frameId": "3",
                  "id": "→1[0]→2[1]→3[0]",
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
              "type": "success",
              "value": 12,
            },
          },
        ],
      },
      "scene": {
        "actionAnnotation": undefined,
        "type": "success",
        "value": [
          3,
          4,
        ],
      },
    }
  `);

  expect(exitingValues(exitingSteps)).toEqual([8, 13]);
});

test("runFlowchart works with a single call", () => {
  const { initialStep, exitingSteps } = runHelper(
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

  expect(initialStep).toMatchInlineSnapshot(`
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
    }
  `);

  expect(exitingValues(exitingSteps)).toEqual([13]);
});

test("runFlowchart works with two calls in a row", () => {
  const { initialStep, exitingSteps } = runHelper(twoCallsInARowFlowcharts, 3);

  expect(initialStep).toMatchInlineSnapshot(`
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
            "nextCalls": {
              "3": {
                "initialStep": {
                  "callStack": [
                    {
                      "action": {
                        "flowchartId": "fc2",
                        "type": "call",
                      },
                      "callId": "→1[0]→2[→1[0]→2/→1[0]→2[0]]→3",
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
                  "flowchartId": "fc2",
                  "frameId": "1",
                  "id": "→1[0]→2[→1[0]→2/→1[0]→2[0]]→3/→1[0]",
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
                            "callId": "→1[0]→2[→1[0]→2/→1[0]→2[0]]→3",
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
                        "flowchartId": "fc2",
                        "frameId": "2",
                        "id": "→1[0]→2[→1[0]→2/→1[0]→2[0]]→3/→1[0]→2[0]",
                        "isStuck": false,
                        "nextCalls": {},
                        "nextSteps": {},
                        "scene": {
                          "type": "success",
                          "value": 23,
                        },
                      },
                    ],
                  },
                  "scene": {
                    "actionAnnotation": undefined,
                    "type": "success",
                    "value": 13,
                  },
                },
              },
            },
            "nextSteps": {
              "3": [
                {
                  "callStack": [],
                  "flowchartId": "fc1",
                  "frameId": "3",
                  "id": "→1[0]→2[→1[0]→2/→1[0]→2[0]]→3[→1[0]→2[→1[0]→2/→1[0]→2[0]]→3/→1[0]→2[0]]",
                  "isStuck": false,
                  "nextCalls": {},
                  "nextSteps": {},
                  "scene": {
                    "actionAnnotation": {
                      "returningStepId": "→1[0]→2[→1[0]→2/→1[0]→2[0]]→3/→1[0]→2[0]",
                      "type": "call",
                    },
                    "type": "success",
                    "value": 23,
                  },
                },
              ],
            },
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
    }
  `);

  expect(exitingValues(exitingSteps)).toEqual([23]);
});

test("runFlowchart works with test-assert & escape routes", () => {
  const flowchart: Flowchart = {
    id: "fc1",
    initialFrameId: "1",
    frames: indexById([
      {
        id: "1",
        escapeRouteFrameId: "neg",
      },
      {
        id: "2",
        action: {
          type: "test-assert",
          func: (x) => x > 0,
        },
      },
      {
        id: "pos",
        action: {
          type: "test-func",
          func: (x) => [success(x + 1)],
        },
      },
      {
        id: "neg",
        action: {
          type: "test-func",
          func: (x) => [success(x - 1)],
        },
      },
    ]),
    arrows: [
      { from: "1", to: "2" },
      { from: "2", to: "pos" },
    ],
  };
  const resultPos = runHelper([flowchart], 3);
  expect(exitingValues(resultPos.exitingSteps)).toEqual([4]);
  const resultNeg = runHelper([flowchart], -3);
  expect(exitingValues(resultNeg.exitingSteps)).toEqual([-4]);
});

test("runFlowchart works with a call that returns nothing", () => {
  const { initialStep, exitingSteps } = runHelper(
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
              func: (x) => [],
            },
          },
        ]),
        arrows: [{ from: "1", to: "2" }],
      },
    ],
    3,
  );

  expect(initialStep).toMatchInlineSnapshot(`
    {
      "callStack": [],
      "flowchartId": "fc1",
      "frameId": "1",
      "id": "→1[0]",
      "isStuck": true,
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
            "isStuck": true,
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
                  "id": "→1[0]→2/→1[0]→2",
                  "isStuck": false,
                  "nextCalls": {},
                  "nextSteps": {},
                  "scene": {
                    "errorAnnotation": {
                      "scene": {
                        "actionAnnotation": undefined,
                        "type": "success",
                        "value": 3,
                      },
                      "type": "scene",
                    },
                    "message": "no way to go",
                    "type": "error",
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
        "2": [],
      },
      "scene": {
        "actionAnnotation": undefined,
        "type": "success",
        "value": 3,
      },
    }
  `);

  expect(initialStep.nextCalls["2"]).toBeDefined();

  expect(exitingValues(exitingSteps)).toEqual([]);
});

test("runFlowchart works with a recursive function", () => {
  const { initialStep, exitingSteps } = runHelper(
    [
      {
        id: "fc1",
        initialFrameId: "1",
        frames: indexById([
          { id: "1", escapeRouteFrameId: "escape" },
          {
            id: "2",
            action: {
              type: "test-assert",
              func: (x) => x < 10,
            },
          },
          {
            id: "3",
            action: {
              type: "test-func",
              func: (x) => [success(2 * x)],
            },
          },
          {
            id: "4",
            action: {
              type: "call",
              flowchartId: "fc1",
            },
          },
          { id: "escape", action: { type: "escape" } },
        ]),
        arrows: [
          { from: "1", to: "2" },
          { from: "2", to: "3" },
          { from: "3", to: "4" },
        ],
      },
    ],
    3,
  );

  expect(exitingValues(exitingSteps)).toEqual([12]);
});
