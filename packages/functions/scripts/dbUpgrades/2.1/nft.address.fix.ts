import { FirebaseApp, Firestore } from '@build-5/database';
import { COL, Nft, NftStatus, Transaction, TransactionType } from '@build-5/interfaces';
import {
  AddressUnlockCondition,
  Client,
  Ed25519Address,
  NftOutput,
  UnlockConditionType,
  Utils,
} from '@iota/sdk';

const colletionId = '0x79bc2bc75ee54282f49f886d2f7bcef0413b6684';

export const nftAddressFix = async (app: FirebaseApp) => {
  const db = new Firestore(app);
  const client = new Client({ nodes: ['https://smr1.svrs.io/'] });

  const nfts = await db.collection(COL.NFT).where('collection', '==', colletionId).get<Nft>();
  for (const nft of nfts) {
    if (nft.status !== NftStatus.MINTED || nft.hidden) {
      continue;
    }

    const outputId = await client.nftOutputId(nft.mintingData?.nftId!);
    const output = (await client.getOutput(outputId)).output as NftOutput;
    const unlock = output.unlockConditions.find(
      (u) => u.type === UnlockConditionType.Address,
    ) as AddressUnlockCondition;
    const address = Utils.hexToBech32((unlock.address as Ed25519Address).pubKeyHash, 'smr');

    const docRef = db.doc(`${COL.NFT}/${nft.uid}`);
    await docRef.update({ 'mintingData.address': address });

    const withdrawOrder = await db
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nftId', '==', nft.mintingData?.nftId!)
      .where('payload.walletReference.confirmed', '==', false)
      .limit(1)
      .get<Transaction>();

    if (withdrawOrder.length) {
      const withdrawOrderDocRef = db.doc(`${COL.TRANSACTION}/${withdrawOrder[0].uid}`);
      await withdrawOrderDocRef.update({
        'payload.walletReference.count': 4,
        'payload.walletReference.chainReference': null,
        'payload.sourceAddress': address,
        shouldRetry: true,
      });
    }
  }
};

export const roll = nftAddressFix;
