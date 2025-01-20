import { expect, test } from "vitest";
import { Flowchart, exitingValues, runHelper, success } from "./interpreter";
import { twoCallsInARowFlowcharts } from "./interpreter.ex";
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
      "flowchartId": "fc1",
      "frameId": "1",
      "id": "→1[0]",
      "isStuck": false,
      "nextSteps": {
        "2": [
          {
            "flowchartId": "fc1",
            "frameId": "2",
            "id": "→1[0]→2[0]",
            "isStuck": false,
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
      "flowchartId": "fc1",
      "frameId": "1",
      "id": "→1[0]",
      "isStuck": false,
      "nextSteps": {
        "2": [
          {
            "flowchartId": "fc1",
            "frameId": "2",
            "id": "→1[0]→2[0]",
            "isStuck": false,
            "nextSteps": {
              "4": [
                {
                  "flowchartId": "fc1",
                  "frameId": "4",
                  "id": "→1[0]→2[0]→4[0]",
                  "isStuck": false,
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
            "flowchartId": "fc1",
            "frameId": "3",
            "id": "→1[0]→3[0]",
            "isStuck": false,
            "nextSteps": {
              "4": [
                {
                  "flowchartId": "fc1",
                  "frameId": "4",
                  "id": "→1[0]→3[0]→4[0]",
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
              func: ([x, y]) => [success(x + y), success(x * y)],
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
      "flowchartId": "fc1",
      "frameId": "1",
      "id": "→1[0]",
      "isStuck": false,
      "nextSteps": {
        "2": [
          {
            "flowchartId": "fc1",
            "frameId": "2",
            "id": "→1[0]→2[0]",
            "isStuck": false,
            "nextSteps": {
              "3": [
                {
                  "flowchartId": "fc1",
                  "frameId": "3",
                  "id": "→1[0]→2[0]→3[0]",
                  "isStuck": false,
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
            "flowchartId": "fc1",
            "frameId": "2",
            "id": "→1[0]→2[1]",
            "isStuck": false,
            "nextSteps": {
              "3": [
                {
                  "flowchartId": "fc1",
                  "frameId": "3",
                  "id": "→1[0]→2[1]→3[0]",
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
      "flowchartId": "fc1",
      "frameId": "1",
      "id": "→1[0]",
      "isStuck": false,
      "nextSteps": {
        "2": [
          {
            "flowchartId": "fc1",
            "frameId": "2",
            "id": "→1[0]→2[0]",
            "isStuck": false,
            "nextSteps": {},
            "scene": {
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
      "flowchartId": "fc1",
      "frameId": "1",
      "id": "→1[0]",
      "isStuck": false,
      "nextSteps": {
        "2": [
          {
            "flowchartId": "fc1",
            "frameId": "2",
            "id": "→1[0]→2[0]",
            "isStuck": false,
            "nextSteps": {
              "3": [
                {
                  "flowchartId": "fc1",
                  "frameId": "3",
                  "id": "→1[0]→2[0]→3[0]",
                  "isStuck": false,
                  "nextSteps": {},
                  "scene": {
                    "actionAnnotation": {
                      "initialStep": {
                        "flowchartId": "fc2",
                        "frameId": "1",
                        "id": "→1[0]→2[0]/→1[0]",
                        "isStuck": false,
                        "nextSteps": {
                          "2": [
                            {
                              "flowchartId": "fc2",
                              "frameId": "2",
                              "id": "→1[0]→2[0]/→1[0]→2[0]",
                              "isStuck": false,
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
                      "returningStepId": "→1[0]→2[0]/→1[0]→2[0]",
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

// test("putStepsInStacks works in 'stacked' mode", () => {
//   const { traceTree } = runHelper(branchingFlowchart, 3);
//   const stepsInStacks = putStepsInStacks(traceTree, "stacked");
//   expect(stepsInStacks.stacks).toMatchInlineSnapshot(`
//     {
//       "{"callPath":[],"final":{"flowchartId":"fc1","frameId":"1","stepId":null}}": {
//         "stackPath": {
//           "callPath": [],
//           "final": {
//             "flowchartId": "fc1",
//             "frameId": "1",
//             "stepId": null,
//           },
//         },
//         "stepIds": [
//           "*",
//         ],
//       },
//       "{"callPath":[],"final":{"flowchartId":"fc1","frameId":"2","stepId":null}}": {
//         "stackPath": {
//           "callPath": [],
//           "final": {
//             "flowchartId": "fc1",
//             "frameId": "2",
//             "stepId": null,
//           },
//         },
//         "stepIds": [
//           "*→2[0]",
//           "*→2[1]",
//           "*→2[2]",
//         ],
//       },
//     }
//   `);
// });

// test("putStepsInStacks works in 'unstacked' mode", () => {
//   const { traceTree } = runHelper(branchingFlowchart, 3);
//   const stepsInStacks = putStepsInStacks(traceTree, "unstacked");
//   expect(stepsInStacks.stacks).toMatchInlineSnapshot(`
//     {
//       "{"callPath":[],"final":{"flowchartId":"fc1","frameId":"1","stepId":"*"}}": {
//         "stackPath": {
//           "callPath": [],
//           "final": {
//             "flowchartId": "fc1",
//             "frameId": "1",
//             "stepId": "*",
//           },
//         },
//         "stepIds": [
//           "*",
//         ],
//       },
//       "{"callPath":[],"final":{"flowchartId":"fc1","frameId":"2","stepId":"*→2[0]"}}": {
//         "stackPath": {
//           "callPath": [],
//           "final": {
//             "flowchartId": "fc1",
//             "frameId": "2",
//             "stepId": "*→2[0]",
//           },
//         },
//         "stepIds": [
//           "*→2[0]",
//         ],
//       },
//       "{"callPath":[],"final":{"flowchartId":"fc1","frameId":"2","stepId":"*→2[1]"}}": {
//         "stackPath": {
//           "callPath": [],
//           "final": {
//             "flowchartId": "fc1",
//             "frameId": "2",
//             "stepId": "*→2[1]",
//           },
//         },
//         "stepIds": [
//           "*→2[1]",
//         ],
//       },
//       "{"callPath":[],"final":{"flowchartId":"fc1","frameId":"2","stepId":"*→2[2]"}}": {
//         "stackPath": {
//           "callPath": [],
//           "final": {
//             "flowchartId": "fc1",
//             "frameId": "2",
//             "stepId": "*→2[2]",
//           },
//         },
//         "stepIds": [
//           "*→2[2]",
//         ],
//       },
//     }
//   `);
// });

// test("stepsInStacksToViewchart works with two calls in a row", () => {
//   const { traceTree } = runHelper(twoCallsInARowFlowcharts, 3);
//   const stepsInStacks = putStepsInStacks(traceTree, "stacked");
//   const viewchart = stepsInStacksToViewchart(stepsInStacks);
//   expect(viewchart).toMatchInlineSnapshot(`
//     {
//       "callPath": [],
//       "callViewchartsByFrameId": {
//         "2": {
//           "callPath": [
//             {
//               "flowchartId": "fc1",
//               "frameId": "2",
//             },
//           ],
//           "callViewchartsByFrameId": {},
//           "flowchartId": "fc2",
//           "stackByFrameId": {
//             "1": {
//               "stackPath": {
//                 "callPath": [
//                   {
//                     "flowchartId": "fc1",
//                     "frameId": "2",
//                   },
//                 ],
//                 "final": {
//                   "flowchartId": "fc2",
//                   "frameId": "1",
//                 },
//               },
//               "stepIds": [
//                 "*→2↓fc2",
//               ],
//             },
//             "2": {
//               "stackPath": {
//                 "callPath": [
//                   {
//                     "flowchartId": "fc1",
//                     "frameId": "2",
//                   },
//                 ],
//                 "final": {
//                   "flowchartId": "fc2",
//                   "frameId": "2",
//                 },
//               },
//               "stepIds": [
//                 "*→2↓fc2→2",
//               ],
//             },
//           },
//         },
//         "3": {
//           "callPath": [
//             {
//               "flowchartId": "fc1",
//               "frameId": "3",
//             },
//           ],
//           "callViewchartsByFrameId": {},
//           "flowchartId": "fc2",
//           "stackByFrameId": {
//             "1": {
//               "stackPath": {
//                 "callPath": [
//                   {
//                     "flowchartId": "fc1",
//                     "frameId": "3",
//                   },
//                 ],
//                 "final": {
//                   "flowchartId": "fc2",
//                   "frameId": "1",
//                 },
//               },
//               "stepIds": [
//                 "*→2↓fc2→2↑fc1→2→3↓fc2",
//               ],
//             },
//             "2": {
//               "stackPath": {
//                 "callPath": [
//                   {
//                     "flowchartId": "fc1",
//                     "frameId": "3",
//                   },
//                 ],
//                 "final": {
//                   "flowchartId": "fc2",
//                   "frameId": "2",
//                 },
//               },
//               "stepIds": [
//                 "*→2↓fc2→2↑fc1→2→3↓fc2→2",
//               ],
//             },
//           },
//         },
//       },
//       "flowchartId": "fc1",
//       "stackByFrameId": {
//         "1": {
//           "stackPath": {
//             "callPath": [],
//             "final": {
//               "flowchartId": "fc1",
//               "frameId": "1",
//             },
//           },
//           "stepIds": [
//             "*",
//           ],
//         },
//         "2": {
//           "stackPath": {
//             "callPath": [],
//             "final": {
//               "flowchartId": "fc1",
//               "frameId": "2",
//             },
//           },
//           "stepIds": [
//             "*→2↓fc2→2↑fc1→2",
//           ],
//         },
//         "3": {
//           "stackPath": {
//             "callPath": [],
//             "final": {
//               "flowchartId": "fc1",
//               "frameId": "3",
//             },
//           },
//           "stepIds": [
//             "*→2↓fc2→2↑fc1→2→3↓fc2→2↑fc1→3",
//           ],
//         },
//       },
//     }
//   `);
//   function countStacks(viewchart: Viewchart) {
//     let count = Object.values(viewchart.stackByFrameId).length;
//     for (const frameId in viewchart.callViewchartsByFrameId) {
//       count += countStacks(viewchart.callViewchartsByFrameId[frameId]);
//     }
//     return count;
//   }
//   // this works cuz there's no ambing
//   expect(countStacks(viewchart)).toBe(Object.values(traceTree.steps).length);
// });
