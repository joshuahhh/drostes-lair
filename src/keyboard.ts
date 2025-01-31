export type ParsedKeyCombo = {
  key: string;
  ctrlCmd: boolean;
  shift: boolean;
  alt: boolean;
}[];

function parseKeyCombo(combo: string): ParsedKeyCombo {
  return combo
    .replaceAll(" ", "")
    .split(",")
    .map((combo_part) => {
      const parts = combo_part.split("+");
      const key = parts.at(-1)!;
      const modifiers = parts.slice(0, -1);
      return {
        key,
        ctrlCmd: modifiers.includes("c"),
        shift: modifiers.includes("s"),
        alt: modifiers.includes("a"),
      };
    });
}

export function matchesCombo(e: KeyboardEvent, combo: string) {
  const parsedCombo = parseKeyCombo(combo);
  return parsedCombo.some(
    (parsedComboPart) =>
      e.key === parsedComboPart.key &&
      (e.ctrlKey || e.metaKey) === parsedComboPart.ctrlCmd &&
      e.shiftKey === parsedComboPart.shift &&
      e.altKey === parsedComboPart.alt,
  );
}
