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

import { Flowchart } from "./interpreter";

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
