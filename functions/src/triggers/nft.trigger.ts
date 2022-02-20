import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { QueryDocumentSnapshot } from "firebase-functions/v1/firestore";
import { COL } from '../../interfaces/models/base';
import { Nft } from '../../interfaces/models/nft';
import { IpfsService, IpfsSuccessResult } from '../services/ipfs/ipfs.service';

export const nftCreate: functions.CloudFunction<QueryDocumentSnapshot> = functions.runWith({
  timeoutSeconds: 180,
  memory: "4GB",
}).firestore.document(COL.NFT + '/{nftId}').onCreate(async (doc) => {
  if (doc.data().media) {
    const refCollection: any = admin.firestore().collection(COL.COLLECTION).doc(doc.data().collection);
    const docCollection: any = await refCollection.get();

    const ipfs: IpfsService = new IpfsService();
    const obj: IpfsSuccessResult|undefined = await ipfs.fileUpload(doc.data().media, <Nft>doc.data(), docCollection.data());
    if (obj) {
      await admin.firestore().collection(COL.NFT).doc(doc.data().uid).update({
        ipfsMedia: obj.image,
        ipfsMetadata: obj.metadata
      });
    }
  }
});
