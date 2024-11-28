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
