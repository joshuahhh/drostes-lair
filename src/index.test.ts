import { expect, test } from "vitest";
import {
  Definitions,
  Flowchart,
  makeTraceTree,
  runAll,
  scenesByFrame,
} from ".";
import { indexById } from "./util";

const defs: Definitions = {
  procedures: {},
};

test("runAll works with a simple flowchart", () => {
  const flowchart: Flowchart = {
    initialFrameId: "1",
    frames: indexById([
      { id: "1" },
      {
        id: "2",
        action: {
          type: "test",
          func: ({ value: x }) => [
            {
              value: x + 1,
            },
          ],
        },
      },
    ]),
    arrows: [{ from: "1", to: "2" }],
  };
  const traceTree = makeTraceTree();
  runAll(
    flowchart,
    {
      id: "1",
      frameId: "1",
      scene: { value: 3 },
    },
    defs,
    traceTree,
  );
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "finalStepIds": [
        "1.2",
      ],
      "steps": {
        "1": {
          "frameId": "1",
          "id": "1",
          "scene": {
            "value": 3,
          },
        },
        "1.2": {
          "frameId": "2",
          "id": "1.2",
          "prevId": "1",
          "scene": {
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
          "value": 3,
        },
      ],
      "2": [
        {
          "value": 4,
        },
      ],
    }
  `);
});

test("runAll works with NFA split & merge", () => {
  const flowchart: Flowchart = {
    initialFrameId: "1",
    frames: indexById([
      { id: "1" },
      {
        id: "2",
        action: {
          type: "test",
          func: ({ value: [x, y] }) => [
            {
              value: x + y,
            },
          ],
        },
      },
      {
        id: "3",
        action: {
          type: "test",
          func: ({ value: [x, y] }) => [
            {
              value: x * y,
            },
          ],
        },
      },
      {
        id: "4",
        action: {
          type: "test",
          func: ({ value: x }) => [
            {
              value: x + 1,
            },
          ],
        },
      },
    ]),
    arrows: [
      { from: "1", to: "2" },
      { from: "1", to: "3" },
      { from: "2", to: "4" },
      { from: "3", to: "4" },
    ],
  };
  const traceTree = makeTraceTree();
  runAll(
    flowchart,
    {
      id: "1",
      frameId: "1",
      scene: { value: [3, 4] },
    },
    defs,
    traceTree,
  );
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "finalStepIds": [
        "1.2.4",
      ],
      "steps": {
        "1": {
          "frameId": "1",
          "id": "1",
          "scene": {
            "value": [
              3,
              4,
            ],
          },
        },
        "1.2": {
          "frameId": "2",
          "id": "1.2",
          "prevId": "1",
          "scene": {
            "value": 7,
          },
        },
        "1.2.4": {
          "frameId": "4",
          "id": "1.2.4",
          "prevId": "1.2",
          "scene": {
            "value": 8,
          },
        },
      },
    }
  `);
  expect(scenesByFrame(flowchart, traceTree)).toMatchInlineSnapshot(`
    {
      "1": [
        {
          "value": [
            3,
            4,
          ],
        },
      ],
      "2": [
        {
          "value": 7,
        },
      ],
      "3": [],
      "4": [
        {
          "value": 8,
        },
      ],
    }
  `);
});

test("runAll works with SIMD split & merge", () => {
  const flowchart: Flowchart = {
    initialFrameId: "1",
    frames: indexById([
      { id: "1" },
      {
        id: "2",
        action: {
          type: "test",
          func: ({ value: [x, y] }) => [
            {
              value: x + y,
            },
            {
              value: x * y,
            },
          ],
        },
      },
      {
        id: "3",
        action: {
          type: "test",
          func: ({ value: x }) => [
            {
              value: x + 1,
            },
          ],
        },
      },
    ]),
    arrows: [
      { from: "1", to: "2" },
      { from: "2", to: "3" },
    ],
  };
  const traceTree = makeTraceTree();
  runAll(
    flowchart,
    {
      id: "1",
      frameId: "1",
      scene: { value: [3, 4] },
    },
    defs,
    traceTree,
  );
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "finalStepIds": [
        "1.2.3",
        "1.2.3",
      ],
      "steps": {
        "1": {
          "frameId": "1",
          "id": "1",
          "scene": {
            "value": [
              3,
              4,
            ],
          },
        },
        "1.2": {
          "frameId": "2",
          "id": "1.2",
          "prevId": "1",
          "scene": {
            "value": 12,
          },
        },
        "1.2.3": {
          "frameId": "3",
          "id": "1.2.3",
          "prevId": "1.2",
          "scene": {
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
          "value": [
            3,
            4,
          ],
        },
      ],
      "2": [
        {
          "value": 12,
        },
      ],
      "3": [
        {
          "value": 13,
        },
      ],
    }
  `);
});
