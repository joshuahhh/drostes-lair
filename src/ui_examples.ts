import { dominoFlowchart } from "./dominoes.ex";
import { Flowchart } from "./interpreter";
import { UIState } from "./ui_state";
import { assertExtends, indexById } from "./util";

export const examples = assertExtends<Record<string, UIState>>()({
  dominoesBlank: {
    initialValue: {
      width: 4,
      height: 2,
      dominoes: [],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: indexById<Flowchart>([
        {
          id: "♌︎",
          initialFrameId: "1",
          frames: indexById([{ id: "1", action: { type: "start" } }]),
          arrows: [],
        },
      ]),
    },
  },
  dominoesComplete: {
    initialValue: {
      width: 4,
      height: 2,
      dominoes: [],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: indexById<Flowchart>([dominoFlowchart]),
    },
  },
  dominoesSimpleRecurse: {
    initialValue: {
      width: 2,
      height: 2,
      dominoes: [],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
            },
            "0.8910228818433734": {
              id: "0.8910228818433734",
              action: {
                type: "place-domino",
                domino: [
                  [0, 0],
                  [0, 1],
                ],
              },
            },
            "0.9228344533853508": {
              id: "0.9228344533853508",
              action: {
                type: "call",
                flowchartId: "♌︎",
                lens: {
                  type: "domino-grid",
                  dx: 1,
                  dy: 0,
                },
              },
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.8910228818433734",
            },
            {
              from: "0.8910228818433734",
              to: "0.9228344533853508",
            },
          ],
        },
      },
    },
  },
  dominoesUntakenPaths: {
    initialValue: {
      width: 4,
      height: 2,
      dominoes: [],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
            },
            "0.6747159926440511": {
              id: "0.6747159926440511",
              action: {
                type: "place-domino",
                domino: [
                  [3, 0],
                  [4, 0],
                ],
              },
            },
            "0.3405055595336326": {
              id: "0.3405055595336326",
              action: {
                type: "place-domino",
                domino: [
                  [1, 1],
                  [1, 2],
                ],
              },
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.6747159926440511",
            },
            {
              from: "1",
              to: "0.3405055595336326",
            },
          ],
        },
      },
    },
  },
  cardsBlank: {
    initialValue: {
      type: "workspace",
      contents: [["K", "Q", "J", "A"], ["♠", "♣", "♦", "♥"], []],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: indexById<Flowchart>([
        {
          id: "♌︎",
          initialFrameId: "1",
          frames: indexById([{ id: "1", action: { type: "start" } }]),
          arrows: [],
        },
      ]),
    },
  },
  cardsDone: {
    initialValue: {
      type: "workspace",
      contents: [
        ["K", "Q", "J", "A"],
        ["♠", "♣", "♦", "♥"],
      ],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
            },
            "0.24659405590061168": {
              id: "0.24659405590061168",
              action: {
                type: "workspace-pick",
                source: 0,
                index: "any",
                target: {
                  type: "after",
                  index: 1,
                },
              },
            },
            "0.013947261497014196": {
              id: "0.013947261497014196",
              action: {
                type: "workspace-pick",
                source: 1,
                index: "any",
                target: {
                  type: "at",
                  index: 2,
                  side: "after",
                },
              },
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.24659405590061168",
            },
            {
              from: "0.24659405590061168",
              to: "0.013947261497014196",
            },
          ],
        },
      },
    },
  },
  cardsKingOrQueen: {
    initialValue: {
      type: "workspace",
      contents: [
        ["K", "Q", "J", "A"],
        ["♠", "♣", "♦", "♥"],
      ],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
            },
            "0.04794261153881885": {
              id: "0.04794261153881885",
              action: {
                type: "workspace-pick",
                source: 0,
                index: 0,
                target: {
                  type: "after",
                  index: 1,
                },
              },
            },
            "0.7527806732090643": {
              id: "0.7527806732090643",
              action: {
                type: "workspace-pick",
                source: 0,
                index: 1,
                target: {
                  type: "after",
                  index: 1,
                },
              },
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.04794261153881885",
            },
            {
              from: "1",
              to: "0.7527806732090643",
            },
          ],
        },
      },
    },
  },
  cardsMakeRoomForStacks: {
    initialValue: {
      type: "workspace",
      contents: [
        ["K", "Q", "J", "A"],
        ["♠", "♣", "♦", "♥"],
      ],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
            },
            "0.39794335085601507": {
              id: "0.39794335085601507",
              action: {
                type: "workspace-pick",
                source: 0,
                index: "any",
                target: {
                  type: "after",
                  index: 1,
                },
              },
            },
            "0.5130787171417488": {
              id: "0.5130787171417488",
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.39794335085601507",
            },
            {
              from: "1",
              to: "0.5130787171417488",
            },
          ],
        },
      },
    },
  },
  reverseBlank: {
    initialValue: {
      type: "workspace",
      contents: [["a", "b", "c", "d"], []],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: indexById<Flowchart>([
        {
          id: "♌︎",
          initialFrameId: "1",
          frames: indexById([{ id: "1", action: { type: "start" } }]),
          arrows: [],
        },
      ]),
    },
  },
  reverseDone: {
    initialValue: {
      type: "workspace",
      contents: [["a", "b", "c", "d"], []],
    },
    initialFlowchartId: "♌︎",
    defs: {
      flowcharts: {
        "♌︎": {
          id: "♌︎",
          initialFrameId: "1",
          frames: {
            "1": {
              id: "1",
              action: {
                type: "start",
              },
              escapeRouteFrameId: "0.9120936509806226",
            },
            "0.06121677045049312": {
              id: "0.06121677045049312",
              action: {
                type: "workspace-pick",
                source: 0,
                index: "last",
                target: {
                  type: "at",
                  index: 1,
                  side: "after",
                },
              },
            },
            "0.5121800283236944": {
              id: "0.5121800283236944",
              action: {
                type: "call",
                flowchartId: "♌︎",
              },
            },
            "0.9120936509806226": {
              id: "0.9120936509806226",
            },
          },
          arrows: [
            {
              from: "1",
              to: "0.06121677045049312",
            },
            {
              from: "0.06121677045049312",
              to: "0.5121800283236944",
            },
          ],
        },
      },
    },
  },
});
