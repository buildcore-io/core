import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Transaction,
  TransactionCreditType,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { awardCompletedCreditRoll } from '../../../scripts/dbUpgrades/0.19/award.completed.roll';
import { soonApp } from '../../../src/firebase/app/soonApp';
import { soonDb } from '../../../src/firebase/firestore/soondb';
import { AddressDetails, WalletService } from '../../../src/services/wallet/wallet';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';
import { requestFundsFromFaucet } from '../../../test-tangle/faucet';
import { wait } from '../../controls/common';

describe('Award completed trans roll', () => {
  it('Should roll award completed roll', async () => {
    const wallet = await WalletService.newWallet(Network.RMS);

    const targetAddress = await wallet.getNewIotaAddressDetails();

    const count = 2;
    const uids = Array.from(Array(count)).map(() => getRandomEthAddress());
    const addresses: AddressDetails[] = [];
    for (let i = 0; i < count; ++i) {
      const address = await wallet.getNewIotaAddressDetails();
      addresses.push(address);
      await requestFundsFromFaucet(Network.RMS, address.bech32, MIN_IOTA_AMOUNT + 1000 * i);
    }

    const trans = uids.map((uid, index) => ({
      uid,
      type: TransactionType.CREDIT,
      network: Network.RMS,
      payload: {
        amount: MIN_IOTA_AMOUNT,
        sourceAddress: addresses[index].bech32,
        targetAddress: targetAddress.bech32,
        type: TransactionCreditType.AWARD_COMPLETED,
        walletReference: {
          chainReferences: [],
          createdOn: dateToTimestamp(dayjs()),
          confirmed: false,
          chainReference: null,
          processedOn: dateToTimestamp(dayjs()),
          error: '{"route":"blocks","httpStatus":400,"code":"400"}',
          inProgress: false,
          count: 6,
        },
      },
      shouldRetry: false,
      updatedOn: dateToTimestamp(dayjs()),
    }));
    for (const tran of trans) {
      await soonDb().doc(`${COL.TRANSACTION}/${tran.uid}`).create(tran);
    }
    await awardCompletedCreditRoll(soonApp());

    await wait(async () => {
      for (const uid of uids) {
        const tran = await soonDb().doc(`${COL.TRANSACTION}/${uid}`).get<Transaction>();
        if (!tran?.payload?.walletReference?.confirmed) {
          return false;
        }
      }
      return true;
    });
  });
});
