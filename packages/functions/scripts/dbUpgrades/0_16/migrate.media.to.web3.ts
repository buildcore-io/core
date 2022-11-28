import { CarReader } from '@ipld/car';
import { COL } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isEmpty, last } from 'lodash';
import { Web3Storage } from 'web3.storage';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();

const BATCH_LIMIT = 15;

// TODO set token
const web3Client = new Web3Storage({ token: '' });

const migrateMediaToWeb3 = async (col: COL) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(col).where('status', '==', 'minted').limit(BATCH_LIMIT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();

    const promises = snap.docs
      .filter((d) => isEmpty(d.data()?.ipfsRoot))
      .map(async (d) => {
        try {
          const data = d.data()!;
          await Promise.all([
            downloadAndUploadCar(data.ipfsMedia),
            downloadAndUploadCar(data.ipfsMetadata),
          ]);
          await d.ref.update({ ipfsRoot: data.ipfsMedia });
        } catch (error) {
          console.error(col, d.id, error);
        }
      });
    await Promise.all(promises);

    lastDoc = last(snap.docs);
  } while (lastDoc);
};

const downloadAndUploadCar = async (cid: string) => {
  const res = await fetch(`https://ipfs.io/ipfs/${cid}?format=car`);
  const car = await CarReader.fromIterable(res.body as any);
  await web3Client.putCar(car);
};

const runAll = async () => {
  await migrateMediaToWeb3(COL.NFT);
  await migrateMediaToWeb3(COL.COLLECTION);
  await migrateMediaToWeb3(COL.TOKEN);
};

runAll();
