import { COL, GetTopMilestonesRequest, Network } from '@build-5/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { combineLatest, map } from 'rxjs';
import { build5Db } from '../firebase/firestore/build5Db';
import { CommonJoi } from '../services/joi/common';
import { getQueryParams, queryToObservable } from './common';
import { sendLiveUpdates } from './keepAlive';

const getTopMilestonesSchema = Joi.object({
  sessionId: CommonJoi.sessionId(),
});

export const getTopMilestones = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetTopMilestonesRequest>(req, res, getTopMilestonesSchema);
  if (!body) {
    return;
  }

  const observables = Object.values(Network).map((network) =>
    queryToObservable(networkToQuery(network)).pipe(map((r) => ({ [network]: r[0] }))),
  );
  const combined = combineLatest(observables).pipe(
    map((r) => r.reduce((acc, act) => ({ ...acc, ...act }))),
  );
  await sendLiveUpdates(body.sessionId, res, combined);
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
