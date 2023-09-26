import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { creditHighestPayment } from '../../../database/scripts/dbUpgrades/1.0.63/creditHighestPayment';
import { build5App } from '../../src/firebase/app/build5App';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../../test/controls/common';
import { getWallet } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

describe('Credit highest transaction', () => {
  it('Should not credit', async () => {
    const result = await creditHighestPayment(build5App() as any, getRandomEthAddress());
    expect(result).toBe(false);
  });

  it('Should credit', async () => {
    const network = Network.RMS;
    const wallet = await getWallet(network);
    const sourceAddress = await wallet.getNewIotaAddressDetails();
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const payment: Transaction = {
      type: TransactionType.PAYMENT,
      uid: getRandomEthAddress(),
      member: getRandomEthAddress(),
      space: getRandomEthAddress(),
      network,
      payload: {
        amount: MIN_IOTA_AMOUNT,
        sourceAddress: sourceAddress.bech32,
        targetAddress: targetAddress.bech32,
        reconciled: true,
        void: false,
        sourceTransaction: [],
        chainReference: null,
        nft: getRandomEthAddress(),
        collection: getRandomEthAddress(),
        invalidPayment: false,
      },
    };
    const paymentDocRef = build5Db().doc(`${COL.TRANSACTION}/${payment.uid}`);
    await paymentDocRef.create(payment);

    await requestFundsFromFaucet(network, targetAddress.bech32, MIN_IOTA_AMOUNT);

    const result = await creditHighestPayment(build5App() as any, payment.uid);
    expect(result).toBe(true);

    const creditDocRef = build5Db().doc(
      `${COL.TRANSACTION}/0x3c368f6d447e5b703fd5b2d3a9d276809d03affe`,
    );
    const credit = await creditDocRef.get<Transaction>();
    expect(credit?.type).toBe(TransactionType.CREDIT);
    expect(credit?.space).toBe(payment.space);
    expect(credit?.member).toBe(payment.member);
    expect(credit?.network).toBe(payment.network);
    expect(credit?.payload.type).toBe(TransactionPayloadType.DATA_NO_LONGER_VALID);
    expect(credit?.payload.amount).toBe(payment.payload.amount);
    expect(credit?.payload.sourceAddress).toBe(payment.payload.targetAddress);
    expect(credit?.payload.targetAddress).toBe(payment.payload.sourceAddress);
    expect(credit?.payload.nft).toBe(payment.payload.nft);
    expect(credit?.payload.collection).toBe(payment.payload.collection);
    expect(credit?.payload.invalidPayment).toBe(true);

    await wait(async () => {
      const credit = await creditDocRef.get<Transaction>();
      return credit?.payload?.walletReference?.confirmed === true;
    });

    const paymentData = await paymentDocRef.get<Transaction>();
    expect(paymentData?.payload.invalidPayment).toBe(true);
  });
});
