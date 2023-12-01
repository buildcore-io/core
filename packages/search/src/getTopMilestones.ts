import { build5Db } from '@build-5/database';
import { Network, getMilestoneCol } from '@build-5/interfaces';
import { combineLatest, map } from 'rxjs';
import { queryToObservable } from './common';

export const getTopMilestones = async (_: string) => {
  const observables = Object.values(Network).map((network) =>
    queryToObservable(networkToQuery(network)).pipe(map((r) => ({ [network]: r[0] }))),
  );
  return combineLatest(observables).pipe(map((r) => r.reduce((acc, act) => ({ ...acc, ...act }))));
};

const networkToQuery = (network: Network) =>
  build5Db().collection(getMilestoneCol(network)).orderBy('createdOn', 'desc').limit(1);
