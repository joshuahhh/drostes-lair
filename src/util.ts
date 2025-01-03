import { inspect } from "util";

export function log(arg: any) {
  console.log(inspect(arg, { depth: null, colors: true }));
}

export function last<T>(arr: T[]) {
  return arr[arr.length - 1];
}

type Truthy<T> = T extends false | "" | 0 | null | undefined ? never : T;
export function truthy<T>(value: T): value is Truthy<T> {
  return !!value;
}

export function assertNever(_never: never, message?: string): never {
  throw new Error(
    message || `Reached unreachable code: unexpected value ${_never}`,
  );
}

export function indexById<T extends { id: string }>(arr: T[]) {
  return Object.fromEntries(arr.map((item) => [item.id, item]));
}

// Here, we want T to be explicit and U to be inferred, but
// TypeScript doesn't support partial infererence of generic
// arguments, so we curry.
export const assertExtends =
  <T>() =>
  <U extends T>(value: U) =>
    value;
