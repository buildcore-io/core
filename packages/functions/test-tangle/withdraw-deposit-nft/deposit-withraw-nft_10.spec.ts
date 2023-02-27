/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COL,
  Collection,
  CollectionStatus,
  MediaStatus,
  MIN_IOTA_AMOUNT,
  Nft,
  Transaction,
  TransactionType,
  UnsoldMintingOptions,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { mintCollection } from '../../src/runtime/firebase/collection';
import { depositNft, withdrawNft } from '../../src/runtime/firebase/nft';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

const HUGE_CID = 'bafybeiae5ai264zyte7qtnrelp5aplwkgb22yurwnwcqlugwwkxwlyoh4i';

describe('Collection minting', () => {
  const helper = new Helper();
  let nft: Nft;
  let collection: Collection;

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should credit, ipfs invalid', async () => {
    await mintWithCustomNftCID((ipfsMedia) =>
      Array.from(Array(ipfsMedia.length))
        .map(() => 'a')
        .join(''),
    );

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian)
      .where('type', '==', TransactionType.CREDIT_NFT);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1;
    });
    const snap = await query.get();
    const credit = <Transaction>snap.docs[0].data();
    expect(credit.payload.response.code).toBe(2117);
    expect(credit.payload.response.message).toBe('Could not get data from ipfs');
    await isInvalidPayment(credit.payload.sourceTransaction[0]);
  });

  it('Should credit, ipfs max size', async () => {
    await mintWithCustomNftCID(() => HUGE_CID);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian)
      .where('type', '==', TransactionType.CREDIT_NFT);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1;
    });
    const snap = await query.get();
    const credit = <Transaction>snap.docs[0].data();
    expect(credit.payload.response.code).toBe(2118);
    expect(credit.payload.response.message).toBe('Maximum media size is 100 MB');
    await isInvalidPayment(credit.payload.sourceTransaction[0]);
  });

  const isInvalidPayment = async (paymentId: string) => {
    const paymentDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${paymentId}`);
    const payment = (await paymentDocRef.get()).data()!;
    expect(payment.payload.invalidPayment).toBe(true);
  };

  const mintWithCustomNftCID = async (func: (ipfsMedia: string) => string) => {
    nft = await helper.createAndOrderNft();
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection!,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder = await testEnv.wrap(mintCollection)({});
    await requestFundsFromFaucet(
      helper.network,
      helper.guardianAddress!.bech32,
      10 * MIN_IOTA_AMOUNT,
    );
    await helper.walletService!.send(
      helper.guardianAddress!,
      collectionMintOrder.payload.targetAddress,
      collectionMintOrder.payload.amount,
      {},
    );
    await MnemonicService.store(helper.guardianAddress!.bech32, helper.guardianAddress!.mnemonic);

    const unsubscribe = nftDocRef.onSnapshot(async (doc) => {
      const nft = doc.data() as Nft;
      const ipfsMedia = func(nft.ipfsMedia || '');
      if (nft.mediaStatus === MediaStatus.PENDING_UPLOAD && nft.ipfsMedia !== ipfsMedia) {
        await nftDocRef.update({ ipfsMedia });
      }
    });
    await wait(async () => {
      const nft = <Nft>(await nftDocRef.get()).data();
      return nft.mediaStatus === MediaStatus.PENDING_UPLOAD;
    });
    unsubscribe();

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`);
    await wait(async () => {
      collection = <Collection>(await collectionDocRef.get()).data();
      return collection.status === CollectionStatus.MINTED;
    });

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: nft.uid });
    await testEnv.wrap(withdrawNft)({});

    let query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>(await nftDocRef.get()).data();

    await nftDocRef.delete();
    await admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`).delete();
  };
});
