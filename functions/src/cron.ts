import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { COL, SUB_COL } from '../../functions/interfaces/models/base';
import { DEFAULT_TRANSACTION_RETRY, DEF_WALLET_PAY_IN_PROGRESS, EXTENDED_TRANSACTION_RETRY, MAX_WALLET_RETRY } from '../interfaces/config';
import { Collection, PaymentTransaction, Transaction, TransactionOrder, TransactionType } from '../interfaces/models';
import { Nft } from '../interfaces/models/nft';
import { IpfsService, IpfsSuccessResult } from './services/ipfs/ipfs.service';
import { ProcessingService } from './services/payment/payment-processing';

export const markAwardsAsComplete = functions.pubsub.schedule('every 1 minutes').onRun(async() => {
  const qry = await admin.firestore().collection(COL.AWARD)
    .where('completed', '==', false)
    .where('endDate', '<=', new Date()).get();
  if (qry.size > 0) {
    for (const t of qry.docs) {
      // Mark record as complete.
      functions.logger.info('mark-award-as-complete', "Award marked as complete.", {
        awardId: t.data().uid
      });

      await admin.firestore().collection(COL.AWARD).doc(t.data().uid).update({
        completed: true
      });
    }
  }

  // Finished.
  return null;
});

export const reTryWallet = functions.pubsub.schedule('every 1 minutes').onRun(async() => {
  const qry = await admin.firestore().collection(COL.TRANSACTION)
    .where('payload.walletReference.confirmed', '==', false)
    .where('payload.walletReference.count', '<', MAX_WALLET_RETRY).get();
  if (qry.size > 0) {
    for (const t of qry.docs) {
      // We ignore while there are errors.
      if (t.data().payload.walletReference.chainReference) {
        // If processed on does not exists something went wrong and try again.
        const readyToRun: dayjs.Dayjs = t.data().payload.walletReference.processedOn ? dayjs(t.data().payload.walletReference.processedOn.toDate()).add(DEFAULT_TRANSACTION_RETRY, 'ms') : dayjs().subtract(1, 's');
        const readyToReprocessedWallet: dayjs.Dayjs = t.data().payload.walletReference.processedOn ? dayjs(t.data().payload.walletReference.processedOn.toDate()).add(EXTENDED_TRANSACTION_RETRY, 'ms') : dayjs().subtract(1, 's');
        // This is one is not ready yet.
        if (
          readyToRun.isAfter(dayjs()) ||
          // It can take up to 10 minutes when servers are overloaded.
          (readyToReprocessedWallet.isAfter(dayjs()) && t.data().payload.walletReference?.chainReference.startsWith(DEF_WALLET_PAY_IN_PROGRESS))
        ) {
          continue;
        }

        // Does it exists in sub-collection?
        const ref = await admin.firestore().collectionGroup(SUB_COL.TRANSACTIONS).where('messageId', '==', t.data().payload.walletReference.chainReference).get();
        const refSource = admin.firestore().collection(COL.TRANSACTION).doc(t.data().uid);
        await admin.firestore().runTransaction(async(transaction) => {
          const sfDoc = await transaction.get(refSource);
          if (sfDoc.data()) {
            const data = <Transaction>sfDoc.data();
            const payload = <PaymentTransaction>data.payload
            if (ref.size > 0) {
              payload.walletReference.confirmed = true;
            } else {
              // Save old and retry.
              payload.walletReference.chainReferences = payload.walletReference.chainReferences || [];
              payload.walletReference.chainReference && payload.walletReference.chainReferences.push(payload.walletReference.chainReference);
              payload.walletReference.chainReference = null;
            }

            transaction.update(refSource, data);
          }
        });
      }
    }
  }

  // Finished.
  return null;
});

export const voidExpiredOrders = functions.pubsub.schedule('every 1 minutes').onRun(async() => {
  const qry = await admin.firestore().collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.ORDER)
    .where('payload.void', '==', false)
    .where('payload.reconciled', '==', false)
    .where('payload.expiresOn', '<=', dayjs().toDate()).get();

  if (qry.size > 0) {
    for (const t of qry.docs) {
      await admin.firestore().runTransaction(async(transaction) => {
        const refSource = admin.firestore().collection(COL.TRANSACTION).doc(t.data().uid);
        const sfDoc = await transaction.get(refSource);
        const service: ProcessingService = new ProcessingService(transaction);
        await service.markAsVoid(<TransactionOrder>sfDoc.data());

        // This will trigger all update/set.
        service.submit();
      });
    }
  }

  // Finished.
  return null;
});

export const finaliseAuctionNft = functions.pubsub.schedule('every 1 minutes').onRun(async() => {
  const qry = await admin.firestore().collection(COL.NFT)
    .where('auctionTo', '<=', dayjs().toDate()).get();

  if (qry.size > 0) {
    for (const t of qry.docs) {
      await admin.firestore().runTransaction(async(transaction) => {
        const refSource = admin.firestore().collection(COL.NFT).doc(t.data().uid);
        const sfDoc = await transaction.get(refSource);
        const service: ProcessingService = new ProcessingService(transaction);
        await service.markNftAsFinalized(<Nft>sfDoc.data());

        // This will trigger all update/set.
        service.submit();
      });
    }
  }

  // Finished.
  return null;
});

export const hidePlaceholderAfterSoldOut = functions.pubsub.schedule('every 5 minutes').onRun(async() => {
  const qry = await admin.firestore().collection(COL.NFT)
    .where('sold', '==', true)
    .where('placeholderNft', '==', true)
    .where('availableFrom', '==', null)
    .where('hidden', '==', false)
    .where('owner', '==', null).get();
  if (qry.size > 0) {
    for (const t of qry.docs) {
      if (t.data().soldOn && t.data().soldOn.toDate() && dayjs(t.data().soldOn.toDate()).isBefore(dayjs().add(24, 'hours'))) {
        await admin.firestore().collection(COL.NFT).doc(t.data().uid).update({
          hidden: true
        });
      }
    }
  }

  // Finished.
  return null;
});

const MAX_UPLOAD_RETRY = 3;
export const ipfsForNft = functions.runWith({ timeoutSeconds: 540, memory: '2GB' }).pubsub.schedule('every 10 minutes').onRun(async() => {
  const qry = await admin.firestore().collection(COL.NFT).where('ipfsMedia', '==', null).limit(1000).get();;
  if (qry.size > 0) {
    for (const doc of qry.docs) {
      console.log('Processing NFT: ', doc.data().uid, ', media: ', doc.data().media, doc.data().ipfsRetries);
      if (doc.data().media && (doc.data().ipfsRetries || 0) <= MAX_UPLOAD_RETRY) {
        const refCollection = admin.firestore().collection(COL.COLLECTION).doc(doc.data().collection);
        const docCollection = await refCollection.get();

        const ipfs: IpfsService = new IpfsService();
        console.log('Init upload...');
        const obj: IpfsSuccessResult | undefined = await ipfs.fileUpload(doc.data().media, <Nft>doc.data(), <Collection>docCollection.data());
        if (obj) {
          console.log('Setting nft ' + doc.data().uid, ' ', obj.image, obj.metadata);
          await admin.firestore().collection(COL.NFT).doc(doc.data().uid).update({
            ipfsMedia: obj.image,
            ipfsMetadata: obj.metadata
          });
        } else {
          await admin.firestore().collection(COL.NFT).doc(doc.data().uid).update({
            ipfsRetries: admin.firestore.FieldValue.increment(1)
          });
        }
      }
    }
  }
});
