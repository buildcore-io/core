import { FirebaseApp } from '@build-5/database';
import { COL, Network, Nft, NftStatus, Transaction, TransactionType } from '@build-5/interfaces';
import {
  AddressUnlockCondition,
  Client,
  Ed25519Address,
  NftOutput,
  UnlockConditionType,
  Utils,
} from '@iota/sdk';
import dayjs from 'dayjs';
import { Firestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

const mintedAfter = dayjs.unix(1700006400);

export const nftAddressFix = async (app: FirebaseApp) => {
  const db = app.getInstance().firestore() as Firestore;
  const clients = {
    [Network.SMR]: new Client({ nodes: ['https://smr1.svrs.io/'] }),
    [Network.RMS]: new Client({ nodes: ['https://rms1.svrs.io/'] }),
    [Network.IOTA]: new Client({ nodes: ['https://us3.svrs.io/'] }),
    [Network.ATOI]: new Client({ nodes: ['https://rms1.svrs.io/'] }),
  };

  let lastDocRef: any | undefined = undefined;
  do {
    let query = db
      .collection(COL.NFT)
      .where('mintingData.mintedOn', '>=', mintedAfter.toDate())
      .limit(1000);
    if (lastDocRef) {
      query = query.startAfter(lastDocRef);
    }
    const snap = await query.get();
    lastDocRef = last(snap.docs);

    const promises = snap.docs.map(async (doc) => {
      const nft = doc.data() as Nft;
      const network = nft.mintingData?.network!;
      const currentAddress = nft.depositData?.address || nft.mintingData?.address;

      const outputId = await clients[network].nftOutputId(nft.mintingData?.nftId!);
      const output = (await clients[network].getOutput(outputId)).output as NftOutput;
      const unlock = output.unlockConditions.find(
        (u) => u.type === UnlockConditionType.Address,
      ) as AddressUnlockCondition;
      const actualAddress = Utils.hexToBech32(
        (unlock.address as Ed25519Address).pubKeyHash,
        network,
      );

      if (currentAddress !== actualAddress) {
        const docRef = db.doc(`${COL.NFT}/${nft.uid}`);
        await docRef.update({ 'mintingData.address': actualAddress });
        return;
      }

      if (nft.status === NftStatus.WITHDRAWN) {
        const withdrawOrderSnap = await db
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.WITHDRAW_NFT)
          .where('payload.nftId', '==', nft.mintingData?.nftId!)
          .where('payload.walletReference.confirmed', '==', false)
          .limit(1)
          .get();

        if (!withdrawOrderSnap.size) {
          return;
        }

        const withdrawOrder = withdrawOrderSnap.docs[0].data() as Transaction;
        const withdrawOrderDocRef = db.doc(`${COL.TRANSACTION}/${withdrawOrder.uid}`);
        await withdrawOrderDocRef.update({
          'payload.walletReference.count': 1,
          'payload.walletReference.chainReference': null,
          'payload.sourceAddress': actualAddress,
          shouldRetry: true,
        });
      }
    });

    await Promise.all(promises);
  } while (lastDocRef);
};

export const roll = nftAddressFix;
