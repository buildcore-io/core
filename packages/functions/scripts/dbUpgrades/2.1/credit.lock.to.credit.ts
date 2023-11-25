import { FirebaseApp, Firestore } from '@build-5/database';
import { COL, Transaction, TransactionType } from '@build-5/interfaces';
import { Client } from '@iota/sdk';
import { get } from 'lodash';

export const setProjectRoll = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  const client = new Client({ nodes: ['https://smr1.svrs.io/'] });

  const creditLocks = await db
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED)
    .where('payload.walletReference.count', '==', 6)
    .where('payload.walletReference.confirmed', '==', false)
    .get<Transaction>();

  for (const cl of creditLocks) {
    const sourceAddress = cl.payload.storageDepositSourceAddress!;
    const balance = await getBalance(client, sourceAddress);

    console.log(cl.uid, sourceAddress, balance);

    const docRef = db.doc(`${COL.TRANSACTION}/${cl.uid}`);
    const data = {
      id: get(cl, 'id', ''),
      space: cl.space || ',',
      member: cl.member,
      project: cl.project,
      network: cl.network,
      shouldRetry: true,
      uid: cl.uid,
      isOrderType: false,
      wenUrl: cl.wenUrl,
      type: TransactionType.CREDIT,
      payload: {
        amount: balance,
        void: false,
        sourceTransaction: cl.payload.sourceTransaction,
        reconciled: false,
        targetAddress: cl.payload.targetAddress,
        sourceAddress,
        walletReference: {
          inProgress: false,
          confirmed: false,
          chainReference: null,
          chainReferences: [],
          count: 0,
        },
        invalidPayment: true,
      },
    };
    await docRef.set(data);
  }
};

const getBalance = async (client: Client, address: string) => {
  const outputIds = await client.basicOutputIds([{ address }, { hasTimelock: false }]);
  const outputs = await client.getOutputs(outputIds.items);
  return outputs.reduce((acc, act) => acc + Number(act.output.amount), 0);
};

export const roll = setProjectRoll;
