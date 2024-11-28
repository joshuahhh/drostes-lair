import { last } from "./util";

// STATIC WORLD

export type Flowchart = {
  initialFrameId: string;
  frames: Frame[];
  arrows: { from: string; to: string }[];
};

export type Frame = {
  id: string;
  action?: (input: Scene) => Scene[];
};

// DYNAMIC WORLD

export type Trace = {
  steps: Step[];
};

export type Step = {
  frameId: string;
  scene: Scene;
};

export type Scene = {
  value: any;
};

/**
 * Given trace running in flowchart, returns all completed traces
 * that continue it.
 */
export function runAll(flowchart: Flowchart, trace: Trace): Trace[] {
  // log(trace);
  const { frameId, scene } = last(trace.steps);
  const nextArrows = flowchart.arrows.filter(({ from }) => from === frameId);
  // TODO: If there are no further arrows, we assume the flowchart is
  // done. Design decision!
  if (nextArrows.length === 0) {
    return [trace];
  }
  // Otherwise, we follow all arrows.
  return nextArrows.flatMap((nextArrow) => {
    const nextFrameId = nextArrow.to;
    const nextFrame = flowchart.frames.find(({ id }) => nextFrameId === id);
    const nextScenes = nextFrame?.action ? nextFrame.action(scene) : [scene];
    return nextScenes.flatMap((nextScene) => {
      const nextTrace = { ...trace };
      nextTrace.steps = [
        ...nextTrace.steps,
        {
          frameId: nextFrameId,
          scene: nextScene,
        },
      ];
      return runAll(flowchart, nextTrace);
    });
  });
}

export function sceneInFrame(trace: Trace, frameId: string): Scene | undefined {
  const matchingSteps = trace.steps.filter(
    ({ frameId: someFrameId }) => someFrameId === frameId,
  );
  if (matchingSteps.length > 1) {
    throw new Error("we're assuming a trace can only visit a frame once");
  }
  return matchingSteps[0]?.scene;
}

export function scenesByFrame(
  flowchart: Flowchart,
  traces: Trace[],
): Record<string, Scene[]> {
  let ret: Record<string, Scene[]> = {};
  for (const frame of flowchart.frames) {
    const scenesInFrame = traces.flatMap(
      (trace) => sceneInFrame(trace, frame.id) ?? [],
    );
    ret[frame.id] = scenesInFrame;
  }
  return ret;
}
