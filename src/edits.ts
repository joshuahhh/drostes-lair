// const { traceTree, defs } = runHelper(
//     [
//       {
//         id: "fc-outer",
//         initialFrameId: "1",
//         frames: indexById([
//           {
//             id: "1",
//           },
//           {
//             id: "2",
//           },
//         ]),
//         arrows: [{ from: "1", to: "2" }],
//       },
//       //myFlowchart,
//     ],
//     initialValue,
//   );

import { Action, Flowchart } from "./interpreter";

export const appendFrameAfter = (fc: Flowchart, frameId: string) => {
  const newFc = structuredClone(fc);
  const id = Math.random() + "";
  const newFrame = {
    id,
  };
  newFc.arrows.push({ from: frameId, to: id });
  newFc.frames[id] = newFrame;
  return newFc;
};

export const setAction = (
  fc: Flowchart,
  frameId: string,
  action: Action,
  allowOverride = false,
) => {
  const newFc = structuredClone(fc);
  const frame = newFc.frames[frameId];
  if (frame.action && !allowOverride)
    throw "tried to setAction on a frame that has an action!";
  frame.action = action;
  return newFc;
};

export const addEscapeRoute = (fc: Flowchart, frameId: string) => {
  const newFc = structuredClone(fc);
  const newFrame = {
    id: Math.random() + "",
  };
  newFc.frames[frameId].escapeRouteFrameId = newFrame.id;
  newFc.frames[newFrame.id] = newFrame;
  console.log(newFc);
  return newFc;
};

export const deleteFrame = (fc: Flowchart, frameId: string) => {
  // TODO: garbage-collect downstream frames?
  const newFc = structuredClone(fc);
  delete newFc.frames[frameId];
  newFc.arrows = newFc.arrows.filter(
    (arrow) => arrow.from !== frameId && arrow.to !== frameId,
  );
  Object.values(newFc.frames).forEach((frame) => {
    if (frame.escapeRouteFrameId === frameId) {
      delete frame.escapeRouteFrameId;
    }
  });
  return newFc;
};
