/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Member, Nft, NftStatus, Transaction, TransactionType } from '@build-5/interfaces';
import { isEqual } from 'lodash';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { depositNft, withdrawNft } from '../../src/runtime/firebase/nft/index';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { getAddress } from '../../src/utils/address.utils';
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
    expect(nft.isOwned).toBe(false);
    expect(nft.owner).toBeNull();
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
    let depositOrder = await testEnv.wrap(depositNft)({});

    const sourceAddress = await helper.walletService?.getAddressDetails(
      getAddress(guardianData, helper.network!),
    );
    await helper.sendNftToAddress(sourceAddress!, depositOrder.payload.targetAddress);

    await wait(async () => {
      nft = <Nft>await nftDocRef.get();
      return nft.status === NftStatus.MINTED;
    });
    depositOrder = <Transaction>await soonDb().doc(`${COL.TRANSACTION}/${depositOrder.uid}`).get();
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
