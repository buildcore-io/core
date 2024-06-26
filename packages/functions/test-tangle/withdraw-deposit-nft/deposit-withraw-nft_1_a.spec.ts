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
import { isEqual } from 'lodash';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { getAddress } from '../../src/utils/address.utils';
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

  it('Should withdraw minted nft and deposit it back', async () => {
    let nft = await helper.createAndOrderNft();
    await helper.mintCollection();
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
    expect(nft.isOwned).toBe(false);
    expect(nft.owner).toBeUndefined();
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
    let depositOrder = await testEnv.wrap<Transaction>(WEN_FUNC.depositNft);

    const sourceAddress = await helper.walletService?.getAddressDetails(
      getAddress(guardianData, helper.network!),
    );
    await helper.sendNftToAddress(sourceAddress!, depositOrder.payload.targetAddress!);

    await wait(async () => {
      nft = <Nft>await nftDocRef.get();
      return nft.status === NftStatus.MINTED;
    });
    depositOrder = <Transaction>await database().doc(COL.TRANSACTION, depositOrder.uid).get();
    expect(depositOrder.payload.nft).toBe(nft.uid);
    expect(nft.depositData?.storageDeposit).toBe(Number(Object.values(outputs)[0].amount));
    expect(nft.depositData?.address).toBe(depositOrder.payload.targetAddress);
    expect(nft.depositData?.mintedBy).toBe(helper.guardian);
    expect(nft.depositData?.network).toBe(helper.network);
    expect(nft.depositData?.nftId).toBe(mintingData?.nftId);
    expect(nft.depositData?.blockId).toBeDefined();
    expect(nft.depositData?.mintingOrderId).toBe(depositOrder.uid);
    expect(nft.hidden).toBe(false);

    expect(depositOrder.payload.nft).toBe(nft.uid);
    expect(depositOrder.payload.amount).toBe(nft.depositData?.storageDeposit);
    expect(depositOrder.space).toBe(nft.space);

    outputs = await nftWallet.getNftOutputs(undefined, getAddress(guardianData, helper.network));
    expect(Object.keys(outputs).length).toBe(0);
  });
});
