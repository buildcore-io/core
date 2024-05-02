import { database } from '@buildcore/database';
import { Network, getMilestoneCol } from '@buildcore/interfaces';
import { combineLatest, map } from 'rxjs';
import { queryToObservable } from './common';

export const getTopMilestones = async (_: string, isLive: boolean) => {
  const observables = Object.values(Network).map((network) =>
    queryToObservable(networkToQuery(network), isLive).pipe(map((r) => ({ [network]: r[0] }))),
  );
  return combineLatest(observables).pipe(map((r) => r.reduce((acc, act) => ({ ...acc, ...act }))));
};

const networkToQuery = (network: Network) =>
  database().collection(getMilestoneCol(network)).orderBy('createdOn', 'desc').limit(1);
