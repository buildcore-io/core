import { COL, UnsoldMintingOptions } from '@soonaverse/interfaces';
import algoliasearch from 'algoliasearch';
import * as functions from 'firebase-functions';
import { last } from 'lodash';
import admin from '../../admin.config';
import { LastDocType } from '../../utils/common.utils';
import { algoliaAppId, algoliaKey } from '../../utils/config.utils';

const client = algoliasearch(algoliaAppId(), algoliaKey());

export const algoliaRoll = functions
  .runWith({ timeoutSeconds: 540 })
  .https.onRequest(async (_, res) => {
    let lastDoc: LastDocType | undefined = undefined;

    do {
      let query = admin
        .firestore()
        .collection(COL.COLLECTION)
        .where('mintingData.unsoldMintingOptions', '==', UnsoldMintingOptions.BURN_UNSOLD)
        .limit(500);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      const snap = await query.get();
      lastDoc = last(snap.docs);

      const promises = snap.docs.map((doc) => rollAlgolia(doc.id));
      await Promise.all(promises);
    } while (lastDoc);

    res.sendStatus(200);
  });

const rollAlgolia = async (collection: string) => {
  const { hits } = await client.initIndex(COL.NFT).search(collection);
  const promises = hits.map(async (hit) => {
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${hit.objectID}`);
    const nftDoc = await nftDocRef.get();
    if (!nftDoc.exists) {
      client.initIndex(COL.NFT).deleteObject(hit.objectID).wait();
    }
  });
  await Promise.all(promises);
};
