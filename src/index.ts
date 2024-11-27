// @ts-ignore
import { inspect } from "node:util";

function log(arg: any) {
  console.log(inspect(arg, { depth: null, colors: true }));
}

export type Flowchart = {
  initialFrameId: string;
  frames: FlowchartFrame[];
  arrows: { from: string; to: string }[];
};

export type FlowchartFrame = {
  id: string;
  action?: (input: any) => any;
};

export type TraceFrame = {
  value: any;
};

export type Trace = {
  steps: {
    flowchartFrameId: string;
    traceFrame: TraceFrame;
  }[];
};

const myFlowchart: Flowchart = {
  initialFrameId: "1",
  frames: [{ id: "1" }, { id: "2", action: ([x, y]) => x + y }],
  arrows: [{ from: "1", to: "2" }],
};

function run(flowchart: Flowchart, target: TraceFrame): Trace {
  let traceFrame = target;
  let flowchartFrameId = flowchart.initialFrameId;

  const trace: Trace = {
    steps: [
      {
        flowchartFrameId,
        traceFrame,
      },
    ],
  };

  while (true) {
    console.log("before", {
      flowchartFrameId,
      traceFrame,
    });
    const nextArrow = flowchart.arrows.find(
      ({ from }) => from === flowchartFrameId,
    );
    if (!nextArrow) {
      return trace;
    }
    flowchartFrameId = nextArrow.to;
    const FlowchartFrame = flowchart.frames.find(
      ({ id }) => flowchartFrameId === id,
    );
    if (FlowchartFrame?.action) {
      traceFrame = { value: FlowchartFrame.action(traceFrame.value) };
    }
    trace.steps.push({
      flowchartFrameId,
      traceFrame,
    });
  }
}

log(run(myFlowchart, { value: [1, 2] }));
