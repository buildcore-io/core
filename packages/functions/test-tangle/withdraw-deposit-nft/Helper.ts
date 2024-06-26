/* eslint-disable @typescript-eslint/no-explicit-any */
import { database } from '@buildcore/database';
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
  NetworkAddress,
  Nft,
  NftAccess,
  SOON_PROJECT_ID,
  SUB_COL,
  Space,
  Timestamp,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  UnsoldMintingOptions,
  WEN_FUNC,
} from '@buildcore/interfaces';
import {
  AddressUnlockCondition,
  ExpirationUnlockCondition,
  NftOutputBuilderParams,
  ReferenceUnlock,
  StorageDepositReturnUnlockCondition,
  UTXOInput,
  Utils,
} from '@iota/sdk';
import dayjs from 'dayjs';
import { cloneDeep } from 'lodash';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { createUnlock, packEssence, submitBlock } from '../../src/utils/block.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { submitMilestoneFunc, wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';

export class Helper {
  public network = Network.RMS;
  public collection = '';
  public guardian = '';
  public space: Space = {} as any;
  public walletService: Wallet = {} as any;
  public nft: Nft = {} as any;
  public guardianAddress: AddressDetails = {} as any;
  public royaltySpace: Space = {} as any;

  public beforeAll = async () => {
    this.walletService = await getWallet(this.network);
  };

  public beforeEach = async () => {
    this.guardian = await testEnv.createMember();
    this.space = await testEnv.createSpace(this.guardian);
    this.royaltySpace = await testEnv.createSpace(this.guardian);

    mockWalletReturnValue(
      this.guardian!,
      this.createDummyCollection(this.space!.uid, this.royaltySpace!.uid),
    );
    this.collection = (await testEnv.wrap<Collection>(WEN_FUNC.createCollection)).uid;

    await database().doc(COL.COLLECTION, this.collection).update({ approved: true });

    const guardianDocRef = database().doc(COL.MEMBER, this.guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, this.network!);
    this.guardianAddress = await this.walletService?.getAddressDetails(guardianBech32)!;
  };

  public createAndOrderNft = async () => {
    let nft: any = this.createDummyNft(this.collection!);
    delete nft.uid;
    mockWalletReturnValue(this.guardian!, nft);
    nft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);

    await database()
      .doc(COL.NFT, nft.uid)
      .update({ availableFrom: dayjs().subtract(1, 'h').toDate() });

    mockWalletReturnValue(this.guardian!, {
      collection: this.collection,
      nft: nft.uid,
    });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.orderNft);
    await submitMilestoneFunc(order);

    this.nft = <Nft>await database().doc(COL.NFT, nft.uid).get();
    return this.nft;
  };

  public mintCollection = async (expiresAt?: Timestamp) => {
    mockWalletReturnValue(this.guardian!, {
      collection: this.collection!,
      network: this.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder = await testEnv.wrap<Transaction>(WEN_FUNC.mintCollection);
    await requestFundsFromFaucet(
      this.network,
      this.guardianAddress!.bech32,
      10 * MIN_IOTA_AMOUNT,
      expiresAt,
    );
    await this.walletService!.send(
      this.guardianAddress!,
      collectionMintOrder.payload.targetAddress!,
      collectionMintOrder.payload.amount!,
      {},
    );
    await MnemonicService.store(this.guardianAddress!.bech32, this.guardianAddress!.mnemonic);

    const collectionDocRef = database().doc(COL.COLLECTION, this.collection!);
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
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.MINT_COLLECTION)
        .where('payload_type', '==', TransactionPayloadType.SEND_ALIAS_TO_GUARDIAN)
        .where('member', '==', this.guardian)
        .get()
    ).map((d) => <Transaction>d);

    expect(ownerChangeTran.length).toBe(1);
    expect(ownerChangeTran[0].payload?.walletReference?.confirmed).toBe(true);
  };

  public updateGuardianAddress = (address: NetworkAddress) =>
    database()
      .doc(COL.MEMBER, this.guardian)
      .update({ [`${this.network}Address`]: address });

  public sendNftToAddress = async (
    sourceAddress: AddressDetails,
    targetAddressBech32: string,
    expiresOn?: Timestamp,
    nftId?: string,
    storageReturnAddress?: string,
  ) => {
    if (!expiresOn) {
      const order: Transaction = {
        project: SOON_PROJECT_ID,
        type: TransactionType.WITHDRAW_NFT,
        uid: getRandomEthAddress(),
        member: this.guardian,
        createdOn: serverTime(),
        network: this.network,
        payload: {
          sourceAddress: sourceAddress.bech32,
          targetAddress: targetAddressBech32,
          expiresOn: expiresOn || undefined,
          nftId: nftId || '',
        },
      };
      await database().doc(COL.TRANSACTION, order.uid).create(order);
      return order.uid;
    }

    await requestFundsFromFaucet(this.network, sourceAddress.bech32, MIN_IOTA_AMOUNT);

    const nftWallet = new NftWallet(this.walletService!);
    const outputs = await this.walletService!.getOutputs(sourceAddress.bech32, [], false);
    const total = Object.values(outputs).reduce((acc, act) => acc + Number(act.amount), 0);
    const [nftOutputId, consumedNftOutput] = Object.entries(
      await nftWallet.getNftOutputs(undefined, sourceAddress.bech32),
    )[0];

    const nftOutput: NftOutputBuilderParams = cloneDeep(consumedNftOutput);
    const targetAddress = Utils.parseBech32Address(targetAddressBech32);
    nftOutput.unlockConditions = [new AddressUnlockCondition(targetAddress)];
    nftOutput.amount = (Number(nftOutput.amount) + total).toString();

    nftOutput.unlockConditions.push(
      new ExpirationUnlockCondition(
        Utils.parseBech32Address(sourceAddress.bech32),
        dayjs(expiresOn.toDate()).unix(),
      ),
    );

    if (storageReturnAddress) {
      const storageDeposit = Utils.computeStorageDeposit(
        await this.walletService!.client.buildNftOutput(nftOutput),
        this.walletService!.info.protocol.rentStructure,
      );
      nftOutput.unlockConditions.push(
        new StorageDepositReturnUnlockCondition(
          Utils.parseBech32Address(storageReturnAddress),
          storageDeposit,
        ),
      );
    }

    const inputs = [...Object.keys(outputs), nftOutputId].map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment([
      ...Object.values(outputs),
      consumedNftOutput,
    ]);
    const essence = await packEssence(
      this.walletService!,
      inputs,
      inputsCommitment,
      [await this.walletService!.client.buildNftOutput(nftOutput)],
      {},
    );

    const unlocks = [await createUnlock(essence, sourceAddress), new ReferenceUnlock(0)];
    const blockId = await submitBlock(this.walletService!, essence, unlocks);
    await testEnv.createBlock(blockId);
    return blockId;
  };

  public withdrawNftAndAwait = async (nft: string) => {
    mockWalletReturnValue(this.guardian!, { nft });
    await testEnv.wrap(WEN_FUNC.withdrawNft);
    await wait(async () => {
      const snap = await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.WITHDRAW_NFT)
        .where('payload_nft', '==', nft)
        .get();
      return snap[0]?.payload?.walletReference?.confirmed;
    });
  };

  public setAvailableForAuction = async () => {
    mockWalletReturnValue(this.guardian!, this.dummyAuctionData(this.nft!.uid));
    await testEnv.wrap(WEN_FUNC.setForSaleNft);
    await wait(async () => (await database().doc(COL.NFT, this.nft!.uid).get())?.available === 3);
  };

  public setAvailableForSale = async () => {
    mockWalletReturnValue(this.guardian!, this.dummySaleData(this.nft!.uid));
    await testEnv.wrap(WEN_FUNC.setForSaleNft);
    await wait(async () => (await database().doc(COL.NFT, this.nft!.uid).get())?.available === 1);
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
    mockWalletReturnValue(this.guardian!, { uid: spaceId });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.claimSpace);
    await this.walletService!.send(
      this.guardianAddress!,
      order.payload.targetAddress!,
      order.payload.amount!,
      {},
    );
    await MnemonicService.store(this.guardianAddress!.bech32, this.guardianAddress!.mnemonic);

    const spaceDocRef = database().doc(COL.SPACE, spaceId);
    await wait(async () => {
      const space = <Space>await spaceDocRef.get();
      return space.claimed || false;
    });

    const space = <Space>await spaceDocRef.get();
    expect(space.claimed).toBe(true);
    expect(space.totalMembers).toBe(1);
    expect(space.totalGuardians).toBe(1);

    const spaceMemberDocRef = database().doc(COL.SPACE, spaceId, SUB_COL.MEMBERS, this.guardian!);
    const spaceMember = await spaceMemberDocRef.get();
    expect(spaceMember !== undefined).toBe(true);

    const spaceGuardianDocRef = database().doc(
      COL.SPACE,
      spaceId,
      SUB_COL.GUARDIANS,
      this.guardian!,
    );
    const spaceGuardian = await spaceGuardianDocRef.get();
    expect(spaceGuardian !== undefined).toBe(true);

    const guardianDocRef = database().doc(COL.MEMBER, this.guardian);
    const guardianData = <Member>await guardianDocRef.get();
    expect(guardianData.spaces![space.uid].isMember).toBe(true);
  };

  public isInvalidPayment = async (paymentId: string) => {
    const paymentDocRef = database().doc(COL.TRANSACTION, paymentId);
    const payment = (await paymentDocRef.get())!;
    expect(payment.payload.invalidPayment).toBe(true);
  };

  public mintWithCustomNftCID = async (func: (ipfsMedia: string) => string) => {
    let nft = await this.createAndOrderNft();
    const nftDocRef = database().doc(COL.NFT, nft.uid);

    mockWalletReturnValue(this.guardian!, {
      collection: this.collection!,
      network: this.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder = await testEnv.wrap<Transaction>(WEN_FUNC.mintCollection);
    await requestFundsFromFaucet(this.network, this.guardianAddress!.bech32, 10 * MIN_IOTA_AMOUNT);
    await this.walletService!.send(
      this.guardianAddress!,
      collectionMintOrder.payload.targetAddress!,
      collectionMintOrder.payload.amount!,
      {},
    );
    await MnemonicService.store(this.guardianAddress!.bech32, this.guardianAddress!.mnemonic);

    await wait(
      async () => {
        const nft = <Nft>await nftDocRef.get();
        const ipfsMedia = func(nft.ipfsMedia || '');
        if (nft.mediaStatus === MediaStatus.PENDING_UPLOAD && nft.ipfsMedia !== ipfsMedia) {
          await nftDocRef.update({ ipfsMedia });
        }
        return nft.mediaStatus === MediaStatus.PENDING_UPLOAD && nft.ipfsMedia !== ipfsMedia;
      },
      undefined,
      100,
    );

    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.mediaStatus === MediaStatus.PENDING_UPLOAD;
    });

    const collectionDocRef = database().doc(COL.COLLECTION, this.collection);
    await wait(async () => {
      const collection = <Collection>await collectionDocRef.get();
      return collection.status === CollectionStatus.MINTED;
    });

    mockWalletReturnValue(this.guardian!, { nft: nft.uid });
    await testEnv.wrap(WEN_FUNC.withdrawNft);

    let query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload_nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>await nftDocRef.get();

    await nftDocRef.delete();
    await database().doc(COL.COLLECTION, nft.collection).delete();
  };
}
