import { build5Db } from '@build-5/database';
import { BaseRecord, COL } from '@build-5/interfaces';
import { isEmpty } from 'lodash';

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
      if (isEmpty(data.project)) {
        console.log(collection, data);
        throw Error('Project not defined');
      }
    }
  }
};

export default teardown;
