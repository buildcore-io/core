/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Access,
  COL,
  Categories,
  Collection,
  CollectionStatus,
  CollectionType,
  MIN_IOTA_AMOUNT,
  MediaStatus,
  Member,
  Network,
  Nft,
  NftAccess,
  SUB_COL,
  Space,
  Timestamp,
  Transaction,
  TransactionMintCollectionType,
  TransactionType,
  UnsoldMintingOptions,
} from '@build5/interfaces';
import {
  ADDRESS_UNLOCK_CONDITION_TYPE,
  Bech32Helper,
  EXPIRATION_UNLOCK_CONDITION_TYPE,
  REFERENCE_UNLOCK_TYPE,
  STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE,
  TransactionHelper,
} from '@iota/iota.js-next';
import dayjs from 'dayjs';
import { cloneDeep } from 'lodash';
import { soonDb } from '../../src/firebase/firestore/soondb';
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
import { claimSpace } from '../../src/runtime/firebase/space';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
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
import { MEDIA, getWallet, testEnv } from '../../test/set-up';
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

    const guardianDocRef = soonDb().doc(`${COL.MEMBER}/${this.guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, this.network!);
    this.guardianAddress = await this.walletService?.getAddressDetails(guardianBech32)!;
  };

  public createAndOrderNft = async () => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    mockWalletReturnValue(this.walletSpy, this.guardian!, nft);
    nft = await testEnv.wrap(createNft)({});

    await soonDb()
      .doc(`${COL.NFT}/${nft.uid}`)
      .update({ availableFrom: dayjs().subtract(1, 'h').toDate() });

    mockWalletReturnValue(this.walletSpy, this.guardian!, {
      collection: this.collection,
      nft: nft.uid,
    });
    const order = await testEnv.wrap(orderNft)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    this.nft = <Nft>await soonDb().doc(`${COL.NFT}/${nft.uid}`).get();
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

    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${this.collection}`);
    await wait(async () => {
      const data = <Collection>await collectionDocRef.get();
      return data.status === CollectionStatus.MINTED;
    });

    const collectionData = <Collection>await collectionDocRef.get();
    expect(collectionData.mintingData?.network).toBe(this.network);
    expect(collectionData.mintingData?.mintedBy).toBe(this.guardian);
    expect(collectionData.mintingData?.mintingOrderId).toBe(collectionMintOrder.uid);
    expect(collectionData.mintingData?.address).toBe(collectionMintOrder.payload.targetAddress);
    expect(collectionData.mintingData?.nftsToMint).toBe(0);

    const ownerChangeTran = (
      await soonDb()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.MINT_COLLECTION)
        .where('payload.type', '==', TransactionMintCollectionType.SEND_ALIAS_TO_GUARDIAN)
        .where('member', '==', this.guardian)
        .get()
    ).map((d) => <Transaction>d);

    expect(ownerChangeTran.length).toBe(1);
    expect(ownerChangeTran[0].payload?.walletReference?.confirmed).toBe(true);
  };

  public updateGuardianAddress = (address: string) =>
    soonDb()
      .doc(`${COL.MEMBER}/${this.guardian}`)
      .update({ [`validatedAddress.${this.network}`]: address });

  public sendNftToAddress = async (
    sourceAddress: AddressDetails,
    targetAddressBech32: string,
    expiresOn?: Timestamp,
    nftId?: string,
    storageReturnAddress?: string,
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
      await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
      return order.uid;
    }

    await requestFundsFromFaucet(this.network, sourceAddress.bech32, MIN_IOTA_AMOUNT);

    const nftWallet = new NftWallet(this.walletService!);
    const outputs = await this.walletService!.getOutputs(sourceAddress.bech32, [], false);
    const total = Object.values(outputs).reduce((acc, act) => acc + Number(act.amount), 0);
    const [nftOutputId, consumedNftOutput] = Object.entries(
      await nftWallet.getNftOutputs(undefined, sourceAddress.bech32),
    )[0];

    const nftOutput = cloneDeep(consumedNftOutput);
    const targetAddress = Bech32Helper.addressFromBech32(
      targetAddressBech32,
      this.walletService!.info.protocol.bech32Hrp,
    );
    nftOutput.unlockConditions = [{ type: ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress }];
    nftOutput.amount = (Number(nftOutput.amount) + total).toString();

    if (storageReturnAddress) {
      nftOutput.unlockConditions.push({
        type: STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE,
        amount: TransactionHelper.getStorageDeposit(
          nftOutput,
          this.walletService!.info.protocol.rentStructure,
        ).toString(),
        returnAddress: Bech32Helper.addressFromBech32(
          storageReturnAddress,
          this.walletService!.info.protocol.bech32Hrp,
        ),
      });
    }

    nftOutput.unlockConditions.push({
      type: EXPIRATION_UNLOCK_CONDITION_TYPE,
      returnAddress: Bech32Helper.addressFromBech32(
        sourceAddress.bech32,
        this.walletService!.info.protocol.bech32Hrp,
      ),
      unixTime: dayjs(expiresOn.toDate()).unix(),
    });

    const inputs = [...Object.keys(outputs), nftOutputId].map(TransactionHelper.inputFromOutputId);
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      ...Object.values(outputs),
      consumedNftOutput,
    ]);
    const essence = packEssence(inputs, inputsCommitment, [nftOutput], this.walletService!, {});

    return await submitBlock(
      this.walletService!,
      packPayload(essence, [
        createUnlock(essence, sourceAddress.keyPair),
        { type: REFERENCE_UNLOCK_TYPE, reference: 0 },
      ]),
    );
  };

  public withdrawNftAndAwait = async (nft: string) => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, { nft });
    await testEnv.wrap(withdrawNft)({});
    await wait(async () => {
      const snap = await soonDb()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.WITHDRAW_NFT)
        .where('payload.nft', '==', nft)
        .get<Transaction>();
      return snap[0]?.payload?.walletReference?.confirmed;
    });
  };

  public setAvailableForAuction = async () => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, this.dummyAuctionData(this.nft!.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(
      async () => (await soonDb().doc(`${COL.NFT}/${this.nft!.uid}`).get<Nft>())?.available === 3,
    );
  };

  public setAvailableForSale = async () => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, this.dummySaleData(this.nft!.uid));
    await testEnv.wrap(setForSaleNft)({});
    await wait(
      async () => (await soonDb().doc(`${COL.NFT}/${this.nft!.uid}`).get<Nft>())?.available === 1,
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

  public claimSpaceFunc = async (spaceId: string) => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, { space: spaceId });
    const order = await testEnv.wrap(claimSpace)({});
    await this.walletService!.send(
      this.guardianAddress!,
      order.payload.targetAddress,
      order.payload.amount,
      {},
    );
    await MnemonicService.store(this.guardianAddress!.bech32, this.guardianAddress!.mnemonic);

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${spaceId}`);
    await wait(async () => {
      const space = <Space>await spaceDocRef.get();
      return space.claimed || false;
    });

    const space = <Space>await spaceDocRef.get();
    expect(space.claimed).toBe(true);
    expect(space.totalMembers).toBe(1);
    expect(space.totalGuardians).toBe(1);

    const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(this.guardian!);
    const spaceMember = await spaceMemberDocRef.get();
    expect(spaceMember !== undefined).toBe(true);

    const spaceGuardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(this.guardian!);
    const spaceGuardian = await spaceGuardianDocRef.get();
    expect(spaceGuardian !== undefined).toBe(true);

    const guardianDocRef = soonDb().doc(`${COL.MEMBER}/${this.guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    expect(guardianData.spaces![space.uid].isMember).toBe(true);
  };

  public isInvalidPayment = async (paymentId: string) => {
    const paymentDocRef = soonDb().doc(`${COL.TRANSACTION}/${paymentId}`);
    const payment = (await paymentDocRef.get<Transaction>())!;
    expect(payment.payload.invalidPayment).toBe(true);
  };

  public mintWithCustomNftCID = async (func: (ipfsMedia: string) => string) => {
    let nft = await this.createAndOrderNft();
    const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);

    mockWalletReturnValue(this.walletSpy, this.guardian!, {
      collection: this.collection!,
      network: this.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder = await testEnv.wrap(mintCollection)({});
    await requestFundsFromFaucet(this.network, this.guardianAddress!.bech32, 10 * MIN_IOTA_AMOUNT);
    await this.walletService!.send(
      this.guardianAddress!,
      collectionMintOrder.payload.targetAddress,
      collectionMintOrder.payload.amount,
      {},
    );
    await MnemonicService.store(this.guardianAddress!.bech32, this.guardianAddress!.mnemonic);

    const unsubscribe = nftDocRef.onSnapshot(async (doc) => {
      const nft = doc as Nft;
      const ipfsMedia = func(nft.ipfsMedia || '');
      if (nft.mediaStatus === MediaStatus.PENDING_UPLOAD && nft.ipfsMedia !== ipfsMedia) {
        await nftDocRef.update({ ipfsMedia });
      }
    });
    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.mediaStatus === MediaStatus.PENDING_UPLOAD;
    });
    unsubscribe();

    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${this.collection}`);
    await wait(async () => {
      const collection = <Collection>await collectionDocRef.get();
      return collection.status === CollectionStatus.MINTED;
    });

    mockWalletReturnValue(this.walletSpy, this.guardian!, { nft: nft.uid });
    await testEnv.wrap(withdrawNft)({});

    let query = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>await nftDocRef.get();

    await nftDocRef.delete();
    await soonDb().doc(`${COL.COLLECTION}/${nft.collection}`).delete();
  };
}
