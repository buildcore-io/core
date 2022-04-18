
interface UidAndName {
  readonly uid?: string;
  readonly name?: string
}

const getAllSubstrings = (str: string) => str.split('').map((_, index) => str.slice(0, index + 1))

export const keywords = <T extends UidAndName>(obj: T): T => {
  if (!obj.name && !obj.uid) {
    return obj
  }
  const keywords = [obj.name || '', obj.uid || ''].reduce((acc, act) => [...acc, ...getAllSubstrings(act)], [] as string[])
  return { ...obj, keywords };
};
