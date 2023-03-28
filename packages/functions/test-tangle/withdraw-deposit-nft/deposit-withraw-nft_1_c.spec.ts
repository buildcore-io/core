/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Member, Nft, NftStatus, Transaction, TransactionType } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEqual } from 'lodash';
import { soonDb } from '../../src/firebase/firestore/soondb';
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

  it('Should credit nft with expiration unlock, expired order', async () => {
    const expiresAt = dateToTimestamp(dayjs().add(2, 'h').toDate());
    let nft = await helper.createAndOrderNft();
    await helper.mintCollection(expiresAt);
    const tmpAddress = await helper.walletService!.getNewIotaAddressDetails();
    await helper.updateGuardianAddress(tmpAddress.bech32);

    const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
    const mintingData = (<Nft>await nftDocRef.get()).mintingData;
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: nft.uid });
    await testEnv.wrap(withdrawNft)({});
    const query = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>await nftDocRef.get();
    expect(nft.status).toBe(NftStatus.WITHDRAWN);
    expect(nft.hidden).toBe(true);
    expect(isEqual(nft.mintingData, mintingData)).toBe(true);

    const wallet = (await getWallet(helper.network)) as SmrWallet;
    const guardianData = <Member>await soonDb().doc(`${COL.MEMBER}/${helper.guardian}`).get();
    const nftWallet = new NftWallet(wallet);
    let outputs = await nftWallet.getNftOutputs(
      undefined,
      getAddress(guardianData, helper.network!),
    );
    expect(Object.keys(outputs).length).toBe(1);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await soonDb()
      .doc(`${COL.TRANSACTION}/${depositOrder.uid}`)
      .update({ 'payload.expiresOn': dateToTimestamp(dayjs().subtract(2, 'h').toDate()) });

    const sourceAddress = await helper.walletService?.getAddressDetails(
      getAddress(guardianData, helper.network!),
    );
    await helper.sendNftToAddress(sourceAddress!, depositOrder.payload.targetAddress, expiresAt);

    await wait(async () => {
      const snap = await soonDb()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT_NFT)
        .where('member', '==', helper.guardian!)
        .get<Transaction>();
      return (
        snap.length === 1 &&
        snap[0]!.payload.walletReference?.confirmed &&
        snap[0]!.payload.targetAddress === sourceAddress!.bech32
      );
    });

    outputs = await nftWallet.getNftOutputs(undefined, getAddress(guardianData, helper.network));
    expect(Object.keys(outputs).length).toBe(1);
  });
});
