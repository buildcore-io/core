import { FirebaseApp, Firestore } from '@build-5/database';
import { COL, IgnoreWalletReason, Transaction, TransactionType } from '@build-5/interfaces';
import { FeatureType, MetadataFeature, NftOutput, hexToUtf8 } from '@iota/sdk';
import { WalletService } from '../../../src/services/wallet/wallet.service';

export const confirmScamNftCredits = async (app: FirebaseApp) => {
  const db = new Firestore(app);
  const snap = await db
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.CREDIT_NFT)
    .where('payload.walletReference.confirmed', '==', false)
    .get<Transaction>();

  for (const transaction of snap) {
    const nftId = transaction.payload.nftId;
    if (!nftId) {
      continue;
    }

    const wallet = await WalletService.newWallet(transaction.network);

    try {
      const outputId = await wallet.client.nftOutputId(nftId);
      const output = (await wallet.client.getOutput(outputId)).output as NftOutput;
      const metadata = output.immutableFeatures?.find(
        (f) => f.type === FeatureType.Metadata,
      ) as MetadataFeature;
      const decoded = hexToUtf8(metadata?.data);
      if (decoded.includes('www.consumerlawfirm.com')) {
        await markConfirmed(db, transaction.uid);
      }
    } catch {
      await markConfirmed(db, transaction.uid);
    }
  }
};

const markConfirmed = async (db: Firestore, uid: string) => {
  const docRef = db.doc(`${COL.TRANSACTION}/${uid}`);
  await docRef.update({
    'payload.walletReference': db.deleteField(),
    ignoreWallet: true,
    ignoreWalletReason: IgnoreWalletReason.UNREFUNDABLE_DUE_TIMELOCK_CONDITION,
  });
};

export const roll = confirmScamNftCredits;
