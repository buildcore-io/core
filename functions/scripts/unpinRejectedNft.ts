import axios from 'axios';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyTest.json';

const pinataConfig = {
  // PROD
  key: '', // functions.config()?.pinata?.key,
  secret: '', // functions.config()?.pinata?.secret
}

function removePin<T>(cid: string) {
  const url = `https://api.pinata.cloud/pinning/unpin/` + cid;
  return axios.delete(url, {
    headers: {
      pinata_api_key: pinataConfig.key,
      pinata_secret_api_key: pinataConfig.secret
    }
  });
};

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
db.collection('collection').get().then(async (snapshot) => {
  for (const col of snapshot.docs) {
    await db.collection('nft').where('collection', '==', col.data().uid).get().then(async (snapshot2) => {
      let i = 0;
      for (const nft of snapshot2.docs) {
        if (nft.data().rejected && (nft.data().ipfsMetadata || nft.data().ipfsMedia )) {
          i++;
          console.log('Removing ' + nft.data().ipfsMetadata + ' for nft ' + nft.data().uid + '...')
          if (nft.data().ipfsMetadata) {
            try {
              await removePin(nft.data().ipfsMetadata)
            } catch (e) {
              console.log('...failed to remove.');
            }
          }

          console.log('Removing ' + nft.data().ipfsMedia + ' for nft ' + nft.data().uid + '...')
          if (nft.data().ipfsMedia) {
            try {
              await removePin(nft.data().ipfsMedia)
            } catch (e) {
              console.log('...failed to remove.');
            }
          }

          await db.collection('nft').doc(nft.data().uid).update({
            ipfsMetadata: null,
            ipfsMedia: null
          });
        }
      }

      console.log('Total Rejected in col ' + col.data().uid + ': ', i);
    });
  }
});

