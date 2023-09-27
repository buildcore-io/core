import { build5Db } from '@build-5/database';
import { BaseRecord, COL, SOON_PROJECT_ID } from '@build-5/interfaces';
import { isEqual } from 'lodash';
import { getProjects } from '../src/utils/common.utils';

const collections = [
  COL.AWARD,
  COL.COLLECTION,
  COL.NFT,
  COL.SPACE,
  COL.PROPOSAL,
  COL.TRANSACTION,
  COL.BADGES,
  COL.TOKEN,
  COL.TOKEN_MARKET,
  COL.TOKEN_PURCHASE,
  COL.STAKE,
  COL.STAKE_REWARD,
  COL.NFT_STAKE,
  COL.AIRDROP,
];

const teardown = async () => {
  for (const collection of collections) {
    const snap = await build5Db().collection(collection).get<BaseRecord>();
    for (const data of snap) {
      if (data.project !== SOON_PROJECT_ID) {
        console.log(collection, data);
        throw Error('Project not defined');
      }
      if (!isEqual(data.projects, getProjects([], SOON_PROJECT_ID))) {
        console.log(collection, data);
        throw Error('Projects not set');
      }
    }
  }
};

export default teardown;
