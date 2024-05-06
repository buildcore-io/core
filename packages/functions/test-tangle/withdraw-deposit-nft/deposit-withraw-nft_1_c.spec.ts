/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
import {
  COL,
  Member,
  Nft,
  NftStatus,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { isEqual } from 'lodash';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { wait } from '../../test/controls/common';
import { getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
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

    const nftDocRef = database().doc(COL.NFT, nft.uid);
    const mintingData = (<Nft>await nftDocRef.get()).mintingData;
    mockWalletReturnValue(helper.guardian!, { nft: nft.uid });
    await testEnv.wrap(WEN_FUNC.withdrawNft);
    const query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload_nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>await nftDocRef.get();
    expect(nft.status).toBe(NftStatus.WITHDRAWN);
    expect(nft.hidden).toBe(true);
    delete (nft.mintingData as any).mintedOn;
    delete (mintingData as any).mintedOn;
    expect(isEqual(nft.mintingData, mintingData)).toBe(true);

    const wallet = await getWallet(helper.network);
    const guardianData = <Member>await database().doc(COL.MEMBER, helper.guardian!).get();
    const nftWallet = new NftWallet(wallet);
    let outputs = await nftWallet.getNftOutputs(
      undefined,
      getAddress(guardianData, helper.network!),
    );
    expect(Object.keys(outputs).length).toBe(1);

    mockWalletReturnValue(helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap<Transaction>(WEN_FUNC.depositNft);
    await database()
      .doc(COL.TRANSACTION, depositOrder.uid)
      .update({ payload_expiresOn: dayjs().subtract(2, 'h').toDate() });

    const sourceAddress = await helper.walletService?.getAddressDetails(
      getAddress(guardianData, helper.network!),
    );
    await helper.sendNftToAddress(sourceAddress!, depositOrder.payload.targetAddress!, expiresAt);

    await wait(async () => {
      const snap = await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT_NFT)
        .where('member', '==', helper.guardian!)
        .get();
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
