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

export function assert(
  condition: boolean,
  message?: string,
): asserts condition {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
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

// output order of groups is based on order first item is seen
export function groupBy<T>(
  items: T[],
  keyFunc: (item: T) => string,
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFunc(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

export function mapValues<T, U>(
  obj: Record<string, T>,
  mapFunc: (value: T, key: string) => U,
): Record<string, U> {
  const result: Record<string, U> = {};
  for (const key in obj) {
    result[key] = mapFunc(obj[key], key);
  }
  return result;
}

export type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export function objectEntries<T extends object>(obj: T): Entries<T> {
  return Object.entries(obj) as Entries<T>;
}

export type FromEntries<T> =
  T extends ReadonlyArray<
    readonly [infer K extends string | number | symbol, infer _V]
  >
    ? { [key in K]: Extract<T[number], readonly [key, any]>[1] }
    : never;

export function objectFromEntries<
  T extends ReadonlyArray<readonly [PropertyKey, any]>,
>(entries: T): FromEntries<T> {
  return Object.fromEntries(entries) as FromEntries<T>;
}
