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

export type TraceTree = {
  steps: Step[];
};

export type Step = {
  id: string;
  prevId?: string;
  frameId: string;
  scene: Scene;
};

export type Scene = {
  value: any;
};

/**
 * Given step running in a flowchart, returns all completed traces
 * that continue it.
 */
export function runAll(flowchart: Flowchart, step: Step): TraceTree {
  const { frameId, scene } = step;
  const nextArrows = flowchart.arrows.filter(({ from }) => from === frameId);
  // TODO: If there are no further arrows, we assume the flowchart is
  // done. Design decision!
  if (nextArrows.length === 0) {
    return { steps: [step] };
  }
  // Otherwise, we follow all arrows.
  return {
    steps: [
      step,
      ...nextArrows.flatMap((nextArrow) => {
        const nextFrameId = nextArrow.to;
        const nextFrame = flowchart.frames.find(({ id }) => nextFrameId === id);
        const nextScenes = nextFrame?.action
          ? nextFrame.action(scene)
          : [scene];
        return nextScenes.flatMap((nextScene) => {
          const nextStep = {
            id: `${step.id}.${nextFrameId}`,
            prevId: step.id,
            frameId: nextFrameId,
            scene: nextScene,
          };
          return runAll(flowchart, nextStep).steps;
        });
      }),
    ],
  };
}

export function scenesByFrame(
  flowchart: Flowchart,
  traceTree: TraceTree,
): Record<string, Scene[]> {
  return Object.fromEntries(
    flowchart.frames.map(({ id }) => [
      id,
      traceTree.steps.flatMap((step) => {
        if (step.frameId === id) {
          return [step.scene];
        }
        return [];
      }),
    ]),
  );
}
