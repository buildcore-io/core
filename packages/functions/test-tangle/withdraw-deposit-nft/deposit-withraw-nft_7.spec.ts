/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Member, Network, Nft, Space, SUB_COL, TransactionType } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { depositNft, withdrawNft } from '../../src/runtime/firebase/nft/index';
import { claimSpace } from '../../src/runtime/firebase/space/index';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Collection minting', () => {
  const helper = new Helper();
  let nft: Nft;

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
    nft = await helper.createAndOrderNft();
    await helper.mintCollection();

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
  });

  const claimSpaceFunc = async (spaceId: string) => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { space: spaceId });
    const order = await testEnv.wrap(claimSpace)({});
    await helper.walletService!.send(
      helper.guardianAddress!,
      order.payload.targetAddress,
      order.payload.amount,
      {},
    );
    await MnemonicService.store(helper.guardianAddress!.bech32, helper.guardianAddress!.mnemonic);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${spaceId}`);
    await wait(async () => {
      const space = <Space>(await spaceDocRef.get()).data();
      return space.claimed || false;
    });

    const space = <Space>(await spaceDocRef.get()).data();
    expect(space.claimed).toBe(true);
    expect(space.totalMembers).toBe(1);
    expect(space.totalGuardians).toBe(1);

    const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(helper.guardian!);
    const spaceMember = await spaceMemberDocRef.get();
    expect(spaceMember.exists).toBe(true);

    const spaceGuardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(helper.guardian!);
    const spaceGuardian = await spaceGuardianDocRef.get();
    expect(spaceGuardian.exists).toBe(true);

    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${helper.guardian}`);
    const guardianData = <Member>(await guardianDocRef.get()).data();
    expect(guardianData.spaces![space.uid].isMember).toBe(true);
  };

  it('Should deposit and claim space', async () => {
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);

    await nftDocRef.delete();
    await admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`).delete();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const nftQuery = admin.firestore().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await nftQuery.get();
      return snap.size > 0;
    });
    const snap = await nftQuery.get();
    const migratedNft = <Nft>snap.docs[0].data();

    await claimSpaceFunc(migratedNft.space);
    await claimSpaceFunc(helper.royaltySpace!.validatedAddress![Network.RMS]);
  });
});
