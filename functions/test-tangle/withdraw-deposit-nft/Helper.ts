/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from "dayjs"
import { MIN_IOTA_AMOUNT } from "../../interfaces/config"
import { Categories, Collection, CollectionStatus, CollectionType, Network, Space, Transaction, TransactionMintCollectionType, TransactionType, UnsoldMintingOptions } from "../../interfaces/models"
import { Access, COL } from "../../interfaces/models/base"
import { Nft, NftAccess } from "../../interfaces/models/nft"
import admin from "../../src/admin.config"
import { approveCollection, createCollection } from "../../src/controls/collection.control"
import { mintCollectionOrder } from "../../src/controls/nft/collection-mint.control"
import { createNft, setForSaleNft, withdrawNft } from "../../src/controls/nft/nft.control"
import { orderNft } from "../../src/controls/order.control"
import { SmrWallet } from "../../src/services/wallet/SmrWalletService"
import { WalletService } from "../../src/services/wallet/wallet"
import { serverTime } from "../../src/utils/dateTime.utils"
import * as wallet from '../../src/utils/wallet.utils'
import { getRandomEthAddress } from "../../src/utils/wallet.utils"
import { createMember as createMemberTest, createSpace, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc, wait } from "../../test/controls/common"
import { MEDIA, testEnv } from "../../test/set-up"
import { MilestoneListener } from "../db-sync.utils"
import { requestFundsFromFaucet } from "../faucet"

export class Helper {
  public network = Network.RMS
  public listenerRMS: MilestoneListener | undefined
  public collection: string | undefined
  public guardian: string | undefined
  public space: Space | undefined
  public walletService: SmrWallet | undefined
  public walletSpy: any;
  public nft: Nft | undefined

  public beforeAll = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
    this.listenerRMS = new MilestoneListener(this.network)
    this.walletService = await WalletService.newWallet(this.network) as SmrWallet
  }

  public beforeEach = async () => {
    this.guardian = await createMemberTest(this.walletSpy)
    this.space = await createSpace(this.walletSpy, this.guardian!)

    mockWalletReturnValue(this.walletSpy, this.guardian!, this.createDummyCollection(this.space!.uid));
    this.collection = (await testEnv.wrap(createCollection)({})).uid;

    mockWalletReturnValue(this.walletSpy, this.guardian, { uid: this.collection });
    await testEnv.wrap(approveCollection)({});
  }

  public createAndOrderNft = async () => {
    let nft: any = { media: MEDIA, ...this.createDummyNft(this.collection!) }
    delete nft.uid
    mockWalletReturnValue(this.walletSpy, this.guardian!, nft);
    nft = await testEnv.wrap(createNft)({});

    await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).update({ availableFrom: dayjs().subtract(1, 'h').toDate() })

    mockWalletReturnValue(this.walletSpy, this.guardian!, { collection: this.collection, nft: nft.uid });
    const order = await testEnv.wrap(orderNft)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    this.nft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).get()).data()
    return this.nft
  }

  public mintCollection = async () => {
    mockWalletReturnValue(this.walletSpy, this.guardian!,
      { collection: this.collection!, network: this.network, unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE })
    const collectionMintOrder = await testEnv.wrap(mintCollectionOrder)({})
    await requestFundsFromFaucet(this.network, collectionMintOrder.payload.targetAddress, collectionMintOrder.payload.amount)
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${this.collection}`)
    await wait(async () => {
      const data = <Collection>(await collectionDocRef.get()).data()
      return data.status === CollectionStatus.MINTED
    })

    const collectionData = <Collection>(await collectionDocRef.get()).data()
    expect(collectionData.mintingData?.network).toBe(this.network)
    expect(collectionData.mintingData?.mintedBy).toBe(this.guardian)
    expect(collectionData.mintingData?.mintingOrderId).toBe(collectionMintOrder.uid)
    expect(collectionData.mintingData?.address).toBe(collectionMintOrder.payload.targetAddress)
    expect(collectionData.mintingData?.nftsToMint).toBe(0)

    const ownerChangeTran = (await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.MINT_COLLECTION)
      .where('payload.type', '==', TransactionMintCollectionType.SENT_ALIAS_TO_GUARDIAN)
      .where('member', '==', this.guardian)
      .get()).docs.map(d => <Transaction>d.data())

    expect(ownerChangeTran.length).toBe(1)
    expect(ownerChangeTran[0].payload?.walletReference?.confirmed).toBe(true)
  }

  public updateGuardianAddress = (address: string) =>
    admin.firestore().doc(`${COL.MEMBER}/${this.guardian}`).update({ [`validatedAddress.${this.network}`]: address })

  public sendNftToAddress = async (sourceAddress: string, targetAddress: string) => {
    const order = <Transaction>{
      type: TransactionType.WITHDRAW_NFT,
      uid: getRandomEthAddress(),
      member: this.guardian,
      createdOn: serverTime(),
      network: this.network,
      payload: { sourceAddress, targetAddress }
    }
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
  }

  public withdrawNftAndAwait = async (nft: string) => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, { nft })
    await testEnv.wrap(withdrawNft)({})
    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.WITHDRAW_NFT)
        .where('payload.nft', '==', nft)
        .get()
      return snap.docs[0].data()?.payload?.walletReference?.confirmed
    })
  }

  public setAvailableForAuction = async () => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, this.dummyAuctionData(this.nft!.uid));
    await testEnv.wrap(setForSaleNft)({})
    await wait(async () => (await admin.firestore().doc(`${COL.NFT}/${this.nft!.uid}`).get()).data()?.available === 3)
  }

  public setAvailableForSale = async () => {
    mockWalletReturnValue(this.walletSpy, this.guardian!, this.dummySaleData(this.nft!.uid));
    await testEnv.wrap(setForSaleNft)({})
    await wait(async () => (await admin.firestore().doc(`${COL.NFT}/${this.nft!.uid}`).get()).data()?.available === 1)
  }

  public createDummyCollection = (space: string) => ({
    name: 'Collection A',
    description: 'babba',
    type: CollectionType.CLASSIC,
    royaltiesFee: 0.6,
    category: Categories.ART,
    access: Access.OPEN,
    space,
    royaltiesSpace: space,
    onePerMemberOnly: false,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: 10 * 1000 * 1000
  })


  public createDummyNft = (collection: string, description = 'babba') => ({
    name: 'NFT ' + description,
    description,
    collection,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: 10 * 1000 * 1000,
    uid: getRandomEthAddress()
  })

  public dummyAuctionData = (uid: string) => ({
    nft: uid,
    price: MIN_IOTA_AMOUNT,
    availableFrom: dayjs().toDate(),
    auctionFrom: dayjs().toDate(),
    auctionFloorPrice: MIN_IOTA_AMOUNT,
    auctionLength: 60000 * 4,
    access: NftAccess.OPEN
  })

  public dummySaleData = (uid: string) => ({
    nft: uid,
    price: MIN_IOTA_AMOUNT,
    availableFrom: dayjs().toDate(),
    access: NftAccess.OPEN
  })
}