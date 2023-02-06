/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ADDRESS_UNLOCK_CONDITION_TYPE,
  Bech32Helper,
  EXPIRATION_UNLOCK_CONDITION_TYPE,
  REFERENCE_UNLOCK_TYPE,
  TransactionHelper,
  UnlockTypes,
} from '@iota/iota.js-next';
import {
  Access,
  Categories,
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftAccess,
  Space,
  Timestamp,
  Transaction,
  TransactionMintCollectionType,
  TransactionType,
  UnsoldMintingOptions,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { cloneDeep } from 'lodash';
import admin from '../../src/admin.config';
import {
  approveCollection,
  createCollection,
  mintCollection,
} from '../../src/runtime/firebase/collection/index';
import {
  createNft,
  orderNft,
  setForSaleNft,
  withdrawNft,
} from '../../src/runtime/firebase/nft/index';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { packEssence, packPayload, submitBlock } from '../../src/utils/block.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import { createUnlock } from '../../src/utils/smr.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import {
  createMember as createMemberTest,
  createSpace,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
  wait,
} from '../../test/controls/common';
import { getWallet, MEDIA, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

export class Helper {
  public network = Network.RMS;
  public collection: string | undefined;
  public guardian: string | undefined;
  public space: Space | undefined;
  public walletService: SmrWallet | undefined;
  public walletSpy: any;
  public nft: Nft | undefined;
  public guardianAddress: AddressDetails | undefined;
  public royaltySpace: Space | undefined;

  public beforeAll = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.walletService = (await getWallet(this.network)) as SmrWallet;
  };

  public beforeEach = async () => {
    this.guardian = await createMemberTest(this.walletSpy);
    this.space = await createSpace(this.walletSpy, this.guardian!);
    this.royaltySpace = await createSpace(this.walletSpy, this.guardian!);

    mockWalletReturnValue(
      this.walletSpy,
      this.guardian!,
      this.createDummyCollection(this.space!.uid, this.royaltySpace!.uid),
    );
    this.collection = (await testEnv.wrap(createCollection)({})).uid;

    mockWalletReturnValue(this.walletSpy, this.guardian, { uid: this.collection });
    await testEnv.wrap(approveCollection)({});

    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${this.guardian}`);
    const guardianData = <Member>(await guardianDocRef.get()).data();
    const guardianBech32 = getAddress(guardianData, this.network!);
    this.guardianAddress = await this.walletService?.getAddressDetails(guardianBech32)!;
  };

  public createAndOrderNft = async () => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    mockWalletReturnValue(this.walletSpy, this.guardian!, nft);
    nft = await testEnv.wrap(createNft)({});

    await admin
      .firestore()
      .doc(`${COL.NFT}/${nft.uid}`)
      .update({ availableFrom: dayjs().subtract(1, 'h').toDate() });

    mockWalletReturnValue(this.walletSpy, this.guardian!, {
      collection: this.collection,
      nft: nft.uid,
    });
    const order = await testEnv.wrap(orderNft)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    this.nft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).get()).data();
    return this.nft;
  };

  public mintCollection = async (expiresAt?: Timestamp) => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, {
      collection: this.collection!,
      network: this.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder = await testEnv.wrap(mintCollection)({});
    await requestFundsFromFaucet(
      this.network,
      this.guardianAddress!.bech32,
      10 * MIN_IOTA_AMOUNT,
      expiresAt,
    );
    await this.walletService!.send(
      this.guardianAddress!,
      collectionMintOrder.payload.targetAddress,
      collectionMintOrder.payload.amount,
      {},
    );
    await MnemonicService.store(this.guardianAddress!.bech32, this.guardianAddress!.mnemonic);

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${this.collection}`);
    await wait(async () => {
      const data = <Collection>(await collectionDocRef.get()).data();
      return data.status === CollectionStatus.MINTED;
    });

    const collectionData = <Collection>(await collectionDocRef.get()).data();
    expect(collectionData.mintingData?.network).toBe(this.network);
    expect(collectionData.mintingData?.mintedBy).toBe(this.guardian);
    expect(collectionData.mintingData?.mintingOrderId).toBe(collectionMintOrder.uid);
    expect(collectionData.mintingData?.address).toBe(collectionMintOrder.payload.targetAddress);
    expect(collectionData.mintingData?.nftsToMint).toBe(0);

    const ownerChangeTran = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.MINT_COLLECTION)
        .where('payload.type', '==', TransactionMintCollectionType.SEND_ALIAS_TO_GUARDIAN)
        .where('member', '==', this.guardian)
        .get()
    ).docs.map((d) => <Transaction>d.data());

    expect(ownerChangeTran.length).toBe(1);
    expect(ownerChangeTran[0].payload?.walletReference?.confirmed).toBe(true);
  };

  public sendNftToAddress = async (
    sourceAddress: AddressDetails,
    targetAddressBech32: string,
    expiresOn?: Timestamp,
    nftId?: string,
  ) => {
    if (!expiresOn) {
      const order = <Transaction>{
        type: TransactionType.WITHDRAW_NFT,
        uid: getRandomEthAddress(),
        member: this.guardian,
        createdOn: serverTime(),
        network: this.network,
        payload: {
          sourceAddress: sourceAddress.bech32,
          targetAddress: targetAddressBech32,
          expiresOn: expiresOn || null,
          nftId: nftId || '',
        },
      };
      await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
      return order.uid;
    }

    await requestFundsFromFaucet(this.network, sourceAddress.bech32, MIN_IOTA_AMOUNT);

    const nftWallet = new NftWallet(this.walletService!);
    const outputs = await this.walletService!.getOutputs(sourceAddress.bech32, [], false);
    const total = Object.values(outputs).reduce((acc, act) => acc + Number(act.amount), 0);
    const [nftOutputId, consumedNftOutput] = Object.entries(
      await nftWallet.getNftOutputs(nftId, sourceAddress.bech32),
    )[0];

    const nftOutput = cloneDeep(consumedNftOutput);
    const targetAddress = Bech32Helper.addressFromBech32(
      targetAddressBech32,
      this.walletService!.info.protocol.bech32Hrp,
    );
    nftOutput.unlockConditions = [
      { type: ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress },
      {
        type: EXPIRATION_UNLOCK_CONDITION_TYPE,
        returnAddress: Bech32Helper.addressFromBech32(
          sourceAddress.bech32,
          this.walletService!.info.protocol.bech32Hrp,
        ),
        unixTime: dayjs(expiresOn.toDate()).unix(),
      },
    ];
    nftOutput.amount = (Number(nftOutput.amount) + total).toString();

    const inputs = [...Object.keys(outputs), nftOutputId].map(TransactionHelper.inputFromOutputId);
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      ...Object.values(outputs),
      consumedNftOutput,
    ]);
    const essence = packEssence(inputs, inputsCommitment, [nftOutput], this.walletService!, {});
    const refUnlocks = Object.keys(outputs).map(
      () =>
        ({
          type: REFERENCE_UNLOCK_TYPE,
          reference: 0,
        } as UnlockTypes),
    );
    return await submitBlock(
      this.walletService!,
      packPayload(essence, [createUnlock(essence, sourceAddress.keyPair), ...refUnlocks]),
    );
  };

  public withdrawNftAndAwait = async (nft: string) => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, { nft });
    await testEnv.wrap(withdrawNft)({});
    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.WITHDRAW_NFT)
        .where('payload.nft', '==', nft)
        .get();
      return snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
  };

  public setAvailableForAuction = async () => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, this.dummyAuctionData(this.nft!.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(
      async () =>
        (await admin.firestore().doc(`${COL.NFT}/${this.nft!.uid}`).get()).data()?.available === 3,
    );
  };

  public setAvailableForSale = async () => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, this.dummySaleData(this.nft!.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(
      async () =>
        (await admin.firestore().doc(`${COL.NFT}/${this.nft!.uid}`).get()).data()?.available === 1,
    );
  };

  public createDummyCollection = (space: string, royaltiesSpace: string) => ({
    name: 'Collection A',
    description: 'babba',
    type: CollectionType.CLASSIC,
    royaltiesFee: 0.45,
    category: Categories.ART,
    access: Access.OPEN,
    space,
    royaltiesSpace,
    onePerMemberOnly: false,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: 10 * 1000 * 1000,
    bannerUrl: MEDIA,
  });

  public createDummyNft = (collection: string, description = 'babba') => ({
    name: 'NFT ' + description,
    description,
    collection,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: 10 * 1000 * 1000,
    uid: getRandomEthAddress(),
    media: MEDIA,
    properties: {
      custom: {
        label: 'custom',
        value: 1,
      },
    },
    stats: {
      customStat: {
        label: 'customStat',
        value: 'customStat',
      },
    },
  });

  public dummyAuctionData = (uid: string) => ({
    nft: uid,
    price: MIN_IOTA_AMOUNT,
    availableFrom: dayjs().toDate(),
    auctionFrom: dayjs().toDate(),
    auctionFloorPrice: MIN_IOTA_AMOUNT,
    auctionLength: 60000 * 4,
    access: NftAccess.OPEN,
  });

  public dummySaleData = (uid: string) => ({
    nft: uid,
    price: MIN_IOTA_AMOUNT,
    availableFrom: dayjs().toDate(),
    access: NftAccess.OPEN,
  });
}