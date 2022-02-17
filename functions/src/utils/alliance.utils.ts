export function getAlliancesKeys(alliances?: any, disabled = false): string[] {
  if (!alliances) {
    return [];
  }

  const out: string[] = [];
  for (const [key, space] of Object.entries(alliances)) {
    if (
      ((<any>space).enabled || disabled === false) ||
      (!(<any>space).enabled || disabled === true)
    ) {
      out.push(key);
    }
  }

  return out;
}
