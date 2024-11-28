// not actually using this yet, but maybe we will someday

let nextId: Record<string, number> = {};

export function id(prefix = ""): string {
  if (nextId[prefix] === undefined) {
    nextId[prefix] = 0;
  }
  return (prefix !== "" ? prefix + "-" : "") + nextId[prefix]++;
}

export function resetId() {
  nextId = {};
}
