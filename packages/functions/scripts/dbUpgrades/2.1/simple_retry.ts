import { FirebaseApp, Firestore } from '@build-5/database';
import { COL, Transaction } from '@build-5/interfaces';

// TODO
// Retrying as sender feature get's removed

const transactions = [
  '0x63d03749920b85705904689f22500372928994a9',
  '0x6bc01a345066897e5cdbfac9dae08bc408e0bc70',
  '0xfe02991eb2ab4bb3273d0402606083fad6cfcb6c',
  '0xfe95319d5e8247597f9dddb761af820ab5737946',
  '0x5274151d5f8ad13241380e9f2486662b0f86c50b',
  '0x93393ef3c70fb5aa2e699365bde1907964cec967',
  '0x3c9006ff32f1de438a7e532c2e286e683290eccd',
  '0x8e7e9b08a022e7e522cb62b1ef6caf68f0a0bccc',
  '0x418f9eac53216cf436d991cf7ce7c38bb2d2639b',
  '0x30396bb2134b66ef438b907e344652b43e9b3dd8',
  '0xf5624b55cfe0be0d85b0a3d717563e94d0f7cd39',
  '0x888568f6787f26ca121318542bb32311c67e6968',
  '0xbb0d0365416fd12dccde5c5ecb826a4e14ca44fe',
  '0xde37eda2d22021f838c3ea38d55a711e581f61dc',
  '0xd99d32e40d9877c5242b0b03d19c71d849aa996c',
  '0xba6fe29b9ff830e226857b45285ffc1aad550401',
  '0xc29401a9e987db6cc5960ab3cf5b2e3dce934fea',
  '0xc9e3067b9bdcb1307009fb3bb83b400c896f4d7b',
  '0xe93a7a5c65a677abb64f16f84333d5e4f247ea00',
  '0x6f96166de1ddfa9e398f7d9443c4a852d12adc83',
  '0x7870a65825b1fe371af21773b63b14bb6ecc2fc0',
  '0xcf1dc7d37d29b8f9a8c2752d8e27787e44bdca1b',
  '0xd93e375117f91147198b001cee15845d5f13ee2b',
  '0x6e15416cceb2014177258dc4e6df344bd7ee5c17',
  '0xd882fb1a29b754832dcc8fa8272e7944fef4d682',
  '0xe8c388f768e48c4b5db1803a5088b1fffad7799a',
  '0xfccc8a12bdbb262624b723010cee01ea654af0d2',
  '0xcc60a3ac92fe4c3f93dbf92968dc3d3377842144',
  '0xea196740114a75d50954b0a174ef1d68766327da',
  '0xf6c0e17490f576d915733f25b1013eae2038e337',
  '0xfde2a4df3af17495063a3d969e1e4dbe0555b023',
  '0x9035fe1b5a75126df30c4e04907f81f0c5fa76cf',

  '0x9d738843ab3447445ad20779d43b969b2dd53844',
  '0xce464d2ba1c3a40a5e23ce6ff4710655f8cedc27',
  '0x3acd477406586cea2cf11d2a0adbca9e7d06c32e',
  '0x276586dc9f23c0bfb3901ff72c70b646bc470942',

  '0x09900e9492f141d192f509ea3150a5ae1b8ac2ad',
  '0xfbdb4c8071d8c79c0efa1c0a77f9da8bbc1b9ac9',
  '0x5e520d877ef7f8e2328b5c0304b770b1f2d56e45',
  '0x9a1592aef0e2adf5e36083a901a1026e41af5ffd',
];

export const retryNftWithdraw = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  for (const uid of transactions) {
    const docRef = db.doc(`${COL.TRANSACTION}/${uid}`);
    const transaction = await docRef.get<Transaction>();
    if (!transaction || transaction.payload.walletReference?.confirmed) {
      continue;
    }

    await docRef.update({
      'payload.walletReference': db.deleteField(),
      shouldRetry: true,
    });
  }
};

export const roll = retryNftWithdraw;
