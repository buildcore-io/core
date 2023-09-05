import { build5Db } from '@build-5/database';
import { COL, Network } from '@build-5/interfaces';
import { combineLatest, map } from 'rxjs';
import { queryToObservable } from './common';

export const getTopMilestones = async (_: string) => {
  const observables = Object.values(Network).map((network) =>
    queryToObservable(networkToQuery(network)).pipe(map((r) => ({ [network]: r[0] }))),
  );
  return combineLatest(observables).pipe(map((r) => r.reduce((acc, act) => ({ ...acc, ...act }))));
};

const networkToQuery = (network: Network) =>
  build5Db().collection(getMilestoneColForNetwrok(network)).orderBy('createdOn', 'desc').limit(1);

const getMilestoneColForNetwrok = (network: Network) => {
  switch (network) {
    case Network.IOTA:
      return COL.MILESTONE;
    case Network.ATOI:
      return COL.MILESTONE_ATOI;
    case Network.SMR:
      return COL.MILESTONE_SMR;
    case Network.RMS:
      return COL.MILESTONE_RMS;
  }
};
