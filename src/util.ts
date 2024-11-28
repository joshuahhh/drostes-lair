// @ts-ignore
import { inspect } from "node:util";

export function log(arg: any) {
  console.log(inspect(arg, { depth: null, colors: true }));
}

export function last<T>(arr: T[]) {
  return arr[arr.length - 1];
}
