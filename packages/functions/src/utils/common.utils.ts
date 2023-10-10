import { Access, Collection, MIN_AMOUNT_TO_TRANSFER, Nft, Restrictions } from '@build-5/interfaces';

const MAX_RERUNS = 10;

export const guardedRerun = async (func: () => Promise<boolean>, maxRuns = MAX_RERUNS) => {
  let runGuard = 0;
  let shouldRerun = await func();
  while (shouldRerun) {
    if (runGuard === maxRuns) {
      throw Error('Max runs limit reached: ' + maxRuns);
    }
    shouldRerun = await func();
    ++runGuard;
  }
};

export const generateRandomAmount = () => {
  const min = MIN_AMOUNT_TO_TRANSFER / 1000 / 10;
  return Math.floor(Math.random() * (min * 1.5 - min + 1) + min) * 1000 * 10;
};

export const getRandomElement = <T>(array: T[]) => array[Math.floor(Math.random() * array.length)];

export const getRestrictions = (collection?: Collection, nft?: Nft): Restrictions => {
  let restrictions = {};
  if (collection) {
    restrictions = {
      ...restrictions,
      collection: {
        access: collection.access || Access.OPEN,
        accessAwards: collection.accessAwards || [],
        accessCollections: collection.accessCollections || [],
      },
    };
  }

  if (nft) {
    const nftRestrictions = {
      saleAccess: nft.saleAccess || null,
      saleAccessMembers: nft.saleAccessMembers || [],
    };
    restrictions = { ...restrictions, nft: nftRestrictions };
  }

  return restrictions;
};

export const intToU32 = (value: number) => value & 0xffffffff;
