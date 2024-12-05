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

export const setAction = (fc: Flowchart, frameId: string, action: Action) => {
  const newFc = structuredClone(fc);
  const frame = newFc.frames[frameId];
  if (frame.action) throw "tried to setAction on a frame that has an action!";
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
