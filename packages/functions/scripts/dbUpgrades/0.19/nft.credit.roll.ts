/* eslint-disable @typescript-eslint/no-explicit-any */

import { COL, TransactionType } from '@soonaverse/interfaces';
import { FirebaseApp } from '../../../src/firebase/app/app';
import { Firestore } from '../../../src/firebase/firestore/firestore';

export const nftCreditRoll = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  const creditPharao4701DocRef = db.doc(
    `${COL.TRANSACTION}/0x6b34c2e0be3479f7113cbeff7530ede74edd3706`,
  );
  await creditPharao4701DocRef.set(
    {
      type: TransactionType.CREDIT_NFT,
      payload: {
        nftId: '0x49325c815a65377856a95f80b963dcca481b80da1fa9d6e586dc7a5c5ec1b1d5',
        unlockedBy: '0x6ca5186bbed262576780019b7e3c963183b1ba2d',
        walletReference: {
          chainReferences: ['0x56dd5690569f21fc16bf0983a01c5a5fac2801bcc8e00a25c96b42a44a2d79d2'],
          chainReference: '0x56dd5690569f21fc16bf0983a01c5a5fac2801bcc8e00a25c96b42a44a2d79d2',
          inProgress: false,
          processedOn: { _seconds: 1683916038, _nanoseconds: 760000000 },
          count: 1,
          confirmed: true,
        },
      },
    },
    true,
  );

  const creditPharao4701UnlcokDocRef = db.doc(
    `${COL.TRANSACTION}/0x6ca5186bbed262576780019b7e3c963183b1ba2d`,
  );
  await creditPharao4701UnlcokDocRef.set(
    { payload: { transaction: '0x6b34c2e0be3479f7113cbeff7530ede74edd3706' } },
    true,
  );

  const creditPharao1102DocRef = db.doc(
    `${COL.TRANSACTION}/0xac57825b1a3109bdee81a951aaddcf9db2986829`,
  );
  await creditPharao1102DocRef.update({
    'payload.walletReference': db.deleteField(),
    'payload.unlockedBy': db.deleteField(),
    'payload.nftId': '0x92162db31e346fa780680483592eb0a3a8bd029f8a1f908f17e3aebac2ae066a',
    type: TransactionType.CREDIT_NFT,
  });

  const creditPharao1102UnlockDocRef = db.doc(
    `${COL.TRANSACTION}/0xe9fe86bbf129c2b102568ddc0bc32d7f93bc60e2`,
  );
  await creditPharao1102UnlockDocRef.update({
    'payload.walletReference': db.deleteField(),
    'payload.transaction': db.deleteField(),
    'payload.storageDepositSourceAddress': db.deleteField(),
    'payload.sourceAddress': 'smr1qrxxe77tau3nz5pf5cyv3rskspgwqw0y3kkul082ggyfscmngkp4knj0907',
    'payload.amount': 168100,
    type: TransactionType.CREDIT,
    shouldRetry: true,
  });
};

export const roll = nftCreditRoll;
