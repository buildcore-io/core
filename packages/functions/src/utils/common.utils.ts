import { build5Db } from '@build-5/database';
import {
  Access,
  BaseRecord,
  COL,
  Collection,
  MIN_AMOUNT_TO_TRANSFER,
  Nft,
  Restrictions,
  SOON_PROJECT_ID,
  SUB_COL,
  WenError,
} from '@build-5/interfaces';
import { invalidArgument } from './error.utils';

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

export const assertIsProjectGuardian = async (project: string, member: string) => {
  const projectDocRef = build5Db().doc(`${COL.PROJECT}/${project}`);
  const guardianDoc = await projectDocRef.collection(SUB_COL.GUARDIANS).doc(member).get();
  if (!guardianDoc) {
    throw invalidArgument(WenError.you_are_not_guardian_of_project);
  }
};

export const getProject = (data: BaseRecord | undefined) => data?.project || SOON_PROJECT_ID;

export const getProjects = (data: (BaseRecord | undefined)[], project?: string) =>
  data.reduce(
    (acc, act) => ({ ...acc, ...(act?.projects || {}) }),
    project ? { [project]: true } : {},
  );
