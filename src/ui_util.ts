import { Flowchart, makeTraceTree, runAll } from ".";
import { indexById } from "./util";

export const loadImg = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    // Only use the image after it's loaded
    img.onload = () => resolve(img);
    img.onerror = reject;
  });

// El note: This is copied from runHelper in index.test.ts but
// it uses console.error instead of node_util log
export function runHelper(flowcharts: Flowchart[], value: any) {
  const defs = { flowcharts: indexById(flowcharts) };
  const traceTree = makeTraceTree();
  const flowchart = flowcharts[0];

  const initStep = {
    id: "*",
    prevStepId: undefined,
    flowchartId: flowchart.id,
    frameId: flowchart.initialFrameId,
    scene: { value },
    caller: undefined,
  };
  try {
    runAll(initStep, defs, traceTree);
  } catch (e) {
    if (e instanceof RangeError) {
      console.error(
        "Infinite loop detected, dumping top of traceTree:",
        Object.values(traceTree).slice(10),
      );
    }
    throw e;
  }
  return { traceTree, flowchart, initStep };
}
