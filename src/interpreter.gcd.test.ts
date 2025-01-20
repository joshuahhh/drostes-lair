import { expect, test } from "vitest";
import { Flowchart, exitingValues, runHelper, success } from "./interpreter";
import { indexById } from "./util";

test("runFlowchart works with recursion (gcd!)", () => {
  const flowchart: Flowchart = {
    id: "fc1",
    initialFrameId: "1",
    frames: indexById([
      {
        id: "1",
        escapeRouteFrameId: "a-bigger",
      },
      {
        id: "2",
        action: {
          type: "test-assert",
          func: ([a, b]) => a < b,
        },
      },
      {
        id: "a-smaller",
        action: {
          type: "test-func",
          func: ([a, b]) => [success([a, b - a])],
        },
      },
      {
        id: "a-bigger",
        action: {
          type: "test-func",
          func: ([a, b]) => [success([a - b, b])],
        },
      },
      {
        id: "3",
        action: {
          type: "escape",
        },
        escapeRouteFrameId: "zero",
      },
      {
        id: "4",
        action: {
          type: "test-assert",
          func: ([a, b]) => a > 0 && b > 0,
        },
      },
      {
        id: "non-zero",
        action: {
          type: "call",
          flowchartId: "fc1",
        },
      },
      {
        id: "zero",
        action: {
          type: "escape",
        },
      },
    ]),
    arrows: [
      { from: "1", to: "2" },
      { from: "2", to: "a-smaller" },
      { from: "a-smaller", to: "3" },
      { from: "a-bigger", to: "3" },
      { from: "3", to: "4" },
      { from: "4", to: "non-zero" },
    ],
  };

  const { exitingSteps } = runHelper([flowchart], [252, 105]);

  expect(exitingValues(exitingSteps)).toEqual([[0, 21]]);
});
