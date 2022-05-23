import { Alliance } from "../../interfaces/models";

export const getAlliancesKeys = (alliances?: { [key: string]: Alliance }, disabled = false): string[] =>
  Object.entries(alliances || {}).reduce(
    (out, [key, space]) => (space.enabled !== disabled ? [...out, key] : out),
    [] as string[]
  );
