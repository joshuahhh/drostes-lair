import { expect, test } from "vitest";
import { Flowchart, runAll, scenesByFrame } from ".";

test("runAll works with a simple flowchart", () => {
  const flowchart: Flowchart = {
    initialFrameId: "1",
    frames: [
      { id: "1" },
      {
        id: "2",
        action: ({ value: x }) => [
          {
            value: x + 1,
          },
        ],
      },
    ],
    arrows: [{ from: "1", to: "2" }],
  };
  const traceTree = runAll(flowchart, {
    id: "1",
    frameId: "1",
    scene: { value: 3 },
  });
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "steps": [
        {
          "frameId": "1",
          "id": "1",
          "scene": {
            "value": 3,
          },
        },
        {
          "frameId": "2",
          "id": "1.2",
          "prevId": "1",
          "scene": {
            "value": 4,
          },
        },
      ],
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
    frames: [
      { id: "1" },
      {
        id: "2",
        action: ({ value: [x, y] }) => [
          {
            value: x + y,
          },
        ],
      },
      {
        id: "3",
        action: ({ value: [x, y] }) => [
          {
            value: x * y,
          },
        ],
      },
      {
        id: "4",
        action: ({ value: x }) => [
          {
            value: x + 1,
          },
        ],
      },
    ],
    arrows: [
      { from: "1", to: "2" },
      { from: "1", to: "3" },
      { from: "2", to: "4" },
      { from: "3", to: "4" },
    ],
  };
  const traceTree = runAll(flowchart, {
    id: "1",
    frameId: "1",
    scene: { value: [3, 4] },
  });
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "steps": [
        {
          "frameId": "1",
          "id": "1",
          "scene": {
            "value": [
              3,
              4,
            ],
          },
        },
        {
          "frameId": "2",
          "id": "1.2",
          "prevId": "1",
          "scene": {
            "value": 7,
          },
        },
        {
          "frameId": "4",
          "id": "1.2.4",
          "prevId": "1.2",
          "scene": {
            "value": 8,
          },
        },
        {
          "frameId": "3",
          "id": "1.3",
          "prevId": "1",
          "scene": {
            "value": 12,
          },
        },
        {
          "frameId": "4",
          "id": "1.3.4",
          "prevId": "1.3",
          "scene": {
            "value": 13,
          },
        },
      ],
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
      "3": [
        {
          "value": 12,
        },
      ],
      "4": [
        {
          "value": 8,
        },
        {
          "value": 13,
        },
      ],
    }
  `);
});

test("runAll works with SIMD split & merge", () => {
  const flowchart: Flowchart = {
    initialFrameId: "1",
    frames: [
      { id: "1" },
      {
        id: "2",
        action: ({ value: [x, y] }) => [
          {
            value: x + y,
          },
          {
            value: x * y,
          },
        ],
      },
      {
        id: "3",
        action: ({ value: x }) => [
          {
            value: x + 1,
          },
        ],
      },
    ],
    arrows: [
      { from: "1", to: "2" },
      { from: "2", to: "3" },
    ],
  };
  const traceTree = runAll(flowchart, {
    id: "1",
    frameId: "1",
    scene: { value: [3, 4] },
  });
  expect(traceTree).toMatchInlineSnapshot(`
    {
      "steps": [
        {
          "frameId": "1",
          "id": "1",
          "scene": {
            "value": [
              3,
              4,
            ],
          },
        },
        {
          "frameId": "2",
          "id": "1.2",
          "prevId": "1",
          "scene": {
            "value": 7,
          },
        },
        {
          "frameId": "3",
          "id": "1.2.3",
          "prevId": "1.2",
          "scene": {
            "value": 8,
          },
        },
        {
          "frameId": "2",
          "id": "1.2",
          "prevId": "1",
          "scene": {
            "value": 12,
          },
        },
        {
          "frameId": "3",
          "id": "1.2.3",
          "prevId": "1.2",
          "scene": {
            "value": 13,
          },
        },
      ],
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
        {
          "value": 12,
        },
      ],
      "3": [
        {
          "value": 8,
        },
        {
          "value": 13,
        },
      ],
    }
  `);
});
