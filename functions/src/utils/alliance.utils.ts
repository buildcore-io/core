export function getEnabledAlliancesKeys(alliances?: any): string[] {
  if (!alliances) {
    return [];
  }

  const out: string[] = [];
  for (const [key, space] of Object.entries(alliances)) {
    if ((<any>space).enabled) {
      out.push(key);
    }
  }

  return out;
}
