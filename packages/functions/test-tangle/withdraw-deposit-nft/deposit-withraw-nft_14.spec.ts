/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COL,
  Member,
  Nft,
  Transaction,
  TransactionIgnoreWalletReason,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { depositNft, withdrawNft } from '../../src/runtime/firebase/nft/index';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { getWallet, testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Collection minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should withdraw minted nft and deposit it back', async () => {
    let nft = await helper.createAndOrderNft();
    await helper.mintCollection();
    const tmpAddress = await helper.walletService!.getNewIotaAddressDetails();
    await helper.updateGuardianAddress(tmpAddress.bech32);

    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: nft.uid });
    await testEnv.wrap(withdrawNft)({});
    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>(await nftDocRef.get()).data();

    const wallet = (await getWallet(helper.network)) as SmrWallet;
    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${helper.guardian}`);
    const guardianData = <Member>(await guardianDocRef.get()).data();
    const guardianAddress = getAddress(guardianData, helper.network!);
    const nftWallet = new NftWallet(wallet);
    const outputs = await nftWallet.getNftOutputs(undefined, guardianAddress);
    expect(Object.keys(outputs).length).toBe(1);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    let depositOrder = await testEnv.wrap(depositNft)({});

    const sourceAddress = await helper.walletService!.getAddressDetails(guardianAddress);
    await helper.sendNftToAddress(
      sourceAddress!,
      depositOrder.payload.targetAddress,
      dateToTimestamp(dayjs().add(1, 'd')),
      undefined,
      guardianAddress,
    );

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian)
      .where('type', '==', TransactionType.CREDIT_NFT);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.size === 1;
    });

    const snap = await creditQuery.get();
    const credit = snap.docs[0].data() as Transaction;
    expect(credit.payload.ignoreWallet).toBe(true);
    expect(credit.payload.ignoreWalletReason).toBe(
      TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION,
    );
  });
});
