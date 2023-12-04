import { build5Db } from '@build-5/database';
import { BaseRecord, COL, Transaction, TransactionType } from '@build-5/interfaces';
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

  const transactions = await build5Db().collection(COL.TRANSACTION).get<Transaction>();
  for (const transaction of transactions) {
    expect(transaction.isOrderType).toBe(transaction.type === TransactionType.ORDER);
  }
};

export default teardown;
