import dayjs from "dayjs"
import { isEmpty, isEqual } from "lodash"
import { DEFAULT_NETWORK, MIN_IOTA_AMOUNT } from "../interfaces/config"
import { Categories, Collection, CollectionStatus, CollectionType, Member, Network, Space, Transaction, TransactionMintCollectionType, TransactionType } from "../interfaces/models"
import { Access, COL } from "../interfaces/models/base"
import { Nft, NftAccess, NftStatus } from "../interfaces/models/nft"
import admin from "../src/admin.config"
import { approveCollection, createCollection } from "../src/controls/collection.control"
import { mintCollectionOrder } from '../src/controls/nft/collection-mint.control'
import { createNft, setForSaleNft } from "../src/controls/nft/nft.control"
import { openBid, orderNft } from "../src/controls/order.control"
import { NftWallet } from "../src/services/wallet/NftWallet"
import { SmrWallet } from "../src/services/wallet/SmrWalletService"
import { WalletService } from "../src/services/wallet/wallet"
import { getAddress } from "../src/utils/address.utils"
import { getNftMetadata } from "../src/utils/collection-minting-utils/nft.utils"
import * as wallet from '../src/utils/wallet.utils'
import { getRandomEthAddress } from "../src/utils/wallet.utils"
import { createMember as createMemberTest, createSpace, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc, wait } from "../test/controls/common"
import { testEnv } from "../test/set-up"
import { MilestoneListener } from "./db-sync.utils"
import { requestFundsFromFaucet } from "./faucet"

let walletSpy: any;
const network = Network.RMS
const MEDIA = 'https://firebasestorage.googleapis.com/v0/b/soonaverse-test.appspot.com/o/0x551fd2c7c7bf356bac194587dab2fcd46420054b%2Fpt7u97zf5to%2Fnft_media?alt=media&token=8d3b5fed-4f74-4961-acf2-f22fabd78d03';

describe('Collection minting', () => {
  let listenerRMS: MilestoneListener
  let collection: string
  let guardian: string
  let space: Space
  let member: string
  let walletService: SmrWallet
  let nftWallet: NftWallet

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listenerRMS = new MilestoneListener(network)
    walletService = await WalletService.newWallet(network) as SmrWallet
    nftWallet = new NftWallet(walletService)
  })

  beforeEach(async () => {
    guardian = await createMemberTest(walletSpy)
    member = await createMemberTest(walletSpy)
    space = await createSpace(walletSpy, guardian)

    mockWalletReturnValue(walletSpy, guardian, createDummyCollection(space.uid));
    collection = (await testEnv.wrap(createCollection)({})).uid;

    mockWalletReturnValue(walletSpy, guardian, { uid: collection });
    await testEnv.wrap(approveCollection)({});
  })

  const createAndOrderNft = async (buyAndAuctionId = false, shouldBid = false) => {
    let nft: any = { media: MEDIA, ...createDummyNft(collection) }
    delete nft.uid
    mockWalletReturnValue(walletSpy, guardian, nft);
    nft = await testEnv.wrap(createNft)({});

    if (buyAndAuctionId) {
      await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).update({ availableFrom: dayjs().subtract(1, 'h').toDate() })

      mockWalletReturnValue(walletSpy, guardian, { collection, nft: nft.uid });
      const order = await testEnv.wrap(orderNft)({});
      const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
      await milestoneProcessed(milestone.milestone, milestone.tranId);

      mockWalletReturnValue(walletSpy, guardian, dummyAuctionData(nft.uid));
      await testEnv.wrap(setForSaleNft)({})
      await wait(async () => (await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).get()).data()?.available === 3)

      if (shouldBid) {
        mockWalletReturnValue(walletSpy, member, { nft: nft.uid });
        const bidOrder = await testEnv.wrap(openBid)({})
        const bidMilestone = await submitMilestoneFunc(bidOrder.payload.targetAddress, 2 * MIN_IOTA_AMOUNT);
        await milestoneProcessed(bidMilestone.milestone, bidMilestone.tranId);
      }
    }
    return <Nft>(await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).get()).data()
  }

  const mintCollection = async (burnUnsold = false) => {
    mockWalletReturnValue(walletSpy, guardian, { collection, network, burnUnsold })
    const collectionMintOrder = await testEnv.wrap(mintCollectionOrder)({})
    await requestFundsFromFaucet(network, collectionMintOrder.payload.targetAddress, collectionMintOrder.payload.amount)
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection}`)
    await wait(async () => {
      const data = <Collection>(await collectionDocRef.get()).data()
      return data.status === CollectionStatus.MINTED
    })

    const collectionData = <Collection>(await collectionDocRef.get()).data()
    expect(collectionData.mintingData?.network).toBe(network)
    expect(collectionData.mintingData?.mintedBy).toBe(guardian)
    expect(collectionData.mintingData?.mintingOrderId).toBe(collectionMintOrder.uid)
    expect(collectionData.mintingData?.address).toBe(collectionMintOrder.payload.targetAddress)
    expect(collectionData.mintingData?.nftsToMint).toBe(0)

    const ownerChangeTran = (await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.MINT_COLLECTION)
      .where('payload.type', '==', TransactionMintCollectionType.SENT_ALIAS_TO_GUARDIAN)
      .where('member', '==', guardian)
      .get()).docs.map(d => <Transaction>d.data())

    expect(ownerChangeTran.length).toBe(1)
    expect(ownerChangeTran[0].payload?.walletReference?.confirmed).toBe(true)
  }

  const lockCollectionConfirmed = async () => {
    const lockTran = (await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.MINT_COLLECTION)
      .where('payload.type', '==', TransactionMintCollectionType.LOCK_COLLECTION)
      .where('member', '==', guardian)
      .get()).docs.map(d => <Transaction>d.data())

    expect(lockTran.length).toBe(1)
    expect(lockTran[0].payload?.walletReference?.confirmed).toBe(true)
  }

  it.each([false, true])('Should mint collection with no nfts', async (limited: boolean) => {
    if (limited) {
      await admin.firestore().doc(`${COL.COLLECTION}/${collection}`).update({ limitedEdition: limited })
    }
    await mintCollection()
    if (limited) {
      await lockCollectionConfirmed()
    }
  })

  it.each([false, true])('Should mint collection with many nfts', async (limited: boolean) => {
    if (limited) {
      await admin.firestore().doc(`${COL.COLLECTION}/${collection}`).update({ limitedEdition: limited })
    }
    const count = 190
    const promises = Array.from(Array(count)).map(() => {
      const nft = createDummyNft(collection)
      return admin.firestore().doc(`${COL.NFT}/${nft.uid}`).create(nft)
    })
    await Promise.all(promises)

    await mintCollection()
    if (limited) {
      await lockCollectionConfirmed()
    }

    const nftMintQuery = admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.MINT_COLLECTION)
      .where('payload.type', '==', TransactionMintCollectionType.MINT_NFTS)
      .where('payload.collection', '==', collection)
    await wait(async () => {
      const snap = await nftMintQuery.get()
      return snap.size === 2
    })

    const nftMintTransactions = (await nftMintQuery.get()).docs.map(d => <Transaction>d.data())
    expect(nftMintTransactions.map(t => t.payload.nfts.length).sort()).toEqual([100, 90])

    const nfts = (await admin.firestore().collection(COL.NFT).where('collection', '==', collection).get()).docs.map(d => <Nft>d.data())
    const allMinted = nfts.reduce((acc, act) => acc && act.status === NftStatus.MINTED, true)
    expect(allMinted).toBe(true)
    const allMintedByGuardian = nfts.reduce((acc, act) => acc && act.mintingData?.mintedBy === guardian, true)
    expect(allMintedByGuardian).toBe(true)
    const allHaveAddress = nfts.reduce((acc, act) => acc && !isEmpty(act.mintingData?.address), true)
    expect(allHaveAddress).toBe(true)
    const allHaveStorageDepositSaved = nfts.reduce((acc, act) => acc && act.mintingData?.storageDeposit !== undefined, true)
    expect(allHaveStorageDepositSaved).toBe(true)
  })

  it('Should mint huge nfts', async () => {
    const count = 30
    const description = getRandomDescrptiron()
    const promises = Array.from(Array(count)).map((_, index) => {
      const nft = createHugeNft(collection, index.toString(), description)
      return admin.firestore().doc(`${COL.NFT}/${nft.uid}`).create(nft)
    })
    await Promise.all(promises)
    await mintCollection()

    const nftMintQuery = admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.MINT_COLLECTION)
      .where('payload.type', '==', TransactionMintCollectionType.MINT_NFTS)
      .where('payload.collection', '==', collection)
    await wait(async () => {
      const snap = await nftMintQuery.get()
      return snap.size === 3
    })

    const nftMintTransactions = (await nftMintQuery.get()).docs.map(d => <Transaction>d.data())
    expect(nftMintTransactions.map(t => t.payload.nfts.length).sort()).toEqual([13, 13, 4])

    const nfts = (await admin.firestore().collection(COL.NFT).where('collection', '==', collection).get()).docs.map(d => <Nft>d.data())
    const allMinted = nfts.reduce((acc, act) => acc && act.status === NftStatus.MINTED, true)
    expect(allMinted).toBe(true)
    const allMintedByGuardian = nfts.reduce((acc, act) => acc && act.mintingData?.mintedBy === guardian, true)
    expect(allMintedByGuardian).toBe(true)
    const allHaveAddress = nfts.reduce((acc, act) => acc && !isEmpty(act.mintingData?.address), true)
    expect(allHaveAddress).toBe(true)
    const allHaveStorageDepositSaved = nfts.reduce((acc, act) => acc && act.mintingData?.storageDeposit !== undefined, true)
    expect(allHaveStorageDepositSaved).toBe(true)
  })

  it('Should mint, cancel active sells', async () => {
    await createAndOrderNft()
    await createAndOrderNft(true)
    const nft = await createAndOrderNft(true, true)

    mockWalletReturnValue(walletSpy, guardian, { collection, network })
    const collectionMintOrder = await testEnv.wrap(mintCollectionOrder)({})

    const nftsQuery = admin.firestore().collection(COL.NFT).where('collection', '==', collection)
    let nfts = (await nftsQuery.get()).docs.map(d => <Nft>d.data())
    const allCancelled = nfts.reduce((acc, act) => acc && (
      act.auctionFrom === null &&
      act.auctionTo === null &&
      act.auctionFloorPrice === null &&
      act.auctionLength === null &&
      act.auctionHighestBid === null &&
      act.auctionHighestBidder === null &&
      act.auctionHighestTransaction === null &&
      act.availableFrom === null &&
      act.availablePrice === null
    ), true)
    expect(allCancelled).toBe(true)

    const creditsQuery = admin.firestore().collection(COL.TRANSACTION)
      .where('payload.collection', '==', collection)
      .where('type', '==', TransactionType.CREDIT)
    await wait(async () => {
      const snap = await creditsQuery.get()
      return snap.size === 1
    })
    const credits = (await creditsQuery.get()).docs.map(d => <Transaction>d.data())
    expect(credits.length).toBe(1)
    expect(credits[0].payload.amount).toBe(2 * MIN_IOTA_AMOUNT)
    const bidder = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${member}`).get()).data()
    const order = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${nft.auctionHighestTransaction}`).get()).data()
    expect(credits[0].payload.targetAddress).toBe(getAddress(bidder, DEFAULT_NETWORK))
    expect(credits[0].payload.sourceAddress).toBe(order.payload.targetAddress)

    await requestFundsFromFaucet(network, collectionMintOrder.payload.targetAddress, collectionMintOrder.payload.amount)
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection}`)
    await wait(async () => {
      const data = <Collection>(await collectionDocRef.get()).data()
      return data.status === CollectionStatus.MINTED
    })

    nfts = (await nftsQuery.get()).docs.map(d => <Nft>d.data())
    for (const nft of nfts) {
      const nftOutputs = await nftWallet.getNftOutputs(nft.mintingData?.nftId, undefined)
      expect(Object.keys(nftOutputs).length).toBe(1)
      const metadata = getNftMetadata(Object.values(nftOutputs)[0])
      expect(metadata.uid).toBe(nft.uid)
    }
  })

  it('Should credit second miting order', async () => {
    const tmpAddress1 = await walletService.getNewIotaAddressDetails()
    const tmpAddress2 = await walletService.getNewIotaAddressDetails()

    mockWalletReturnValue(walletSpy, guardian, { collection, network })
    const collectionMintOrder1 = await testEnv.wrap(mintCollectionOrder)({})
    mockWalletReturnValue(walletSpy, guardian, { collection, network })
    const collectionMintOrder2 = await testEnv.wrap(mintCollectionOrder)({})

    expect(isEqual(collectionMintOrder1, collectionMintOrder2)).toBe(false)
    expect(collectionMintOrder1.payload.amount).toBe(collectionMintOrder2.payload.amount)

    await requestFundsFromFaucet(network, tmpAddress1.bech32, collectionMintOrder1.payload.amount)
    await requestFundsFromFaucet(network, tmpAddress2.bech32, collectionMintOrder2.payload.amount)

    const orders = [collectionMintOrder1, collectionMintOrder2]
    const promises = [tmpAddress1, tmpAddress2].map((address, i) => walletService.send(address, orders[i].payload.targetAddress, orders[i].payload.amount, {}))
    await Promise.all(promises)

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection}`)
    await wait(async () => {
      const data = <Collection>(await collectionDocRef.get()).data()
      return data.status === CollectionStatus.MINTED
    })

    const creditQuery = admin.firestore().collection(COL.TRANSACTION).where('type', '==', TransactionType.CREDIT).where('payload.collection', '==', collection)
    await wait(async () => {
      const snap = await creditQuery.get()
      const allConfirmed = snap.docs.reduce((acc, act) => acc && act.data().payload?.walletReference?.confirmed, true)
      return snap.size > 0 && allConfirmed
    })
    const credits = (await creditQuery.get()).docs.map(d => <Transaction>d.data())
    expect(credits.length).toBe(1)

    const hasValidTargetAddress = credits[0].payload.targetAddress === tmpAddress1.bech32 || credits[0].payload.targetAddress === tmpAddress2.bech32
    expect(hasValidTargetAddress).toBe(true)
    expect(credits[0].payload.amount).toBe(collectionMintOrder1.payload.amount)
  })

  it.each([false, true])('Should not burn unsold nfts', async (burnUnsold: boolean) => {
    let nft = <Nft | undefined>(await createAndOrderNft())
    let collectionData = <Collection>(await admin.firestore().doc(`${COL.COLLECTION}/${collection}`).get()).data()
    expect(collectionData.total).toBe(1)
    await mintCollection(burnUnsold)
    collectionData = <Collection>(await admin.firestore().doc(`${COL.COLLECTION}/${collection}`).get()).data()
    expect(collectionData.total).toBe(burnUnsold ? 0 : 1)
    nft = <Nft | undefined>(await admin.firestore().doc(`${COL.NFT}/${nft?.uid}`).get()).data()
    expect(nft === undefined).toBe(burnUnsold)
  })

  afterAll(async () => {
    await listenerRMS.cancel()
  })
})

const createDummyCollection = (space: string) => ({
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

const createDummyNft = (collection: string, description = 'babba') => ({
  name: 'NFT ' + description,
  description,
  collection,
  availableFrom: dayjs().add(1, 'hour').toDate(),
  price: 10 * 1000 * 1000,
  uid: getRandomEthAddress()
})

const dummyAuctionData = (uid: string) => ({
  nft: uid,
  price: MIN_IOTA_AMOUNT,
  availableFrom: dayjs().toDate(),
  auctionFrom: dayjs().toDate(),
  auctionFloorPrice: MIN_IOTA_AMOUNT,
  auctionLength: 60000 * 4,
  access: NftAccess.OPEN
})

const createHugeNft = (collection: string, name: string, description: string) => ({
  name: 'NFT ' + name,
  description,
  collection,
  availableFrom: dayjs().add(1, 'hour').toDate(),
  price: 10 * 1000 * 1000,
  uid: getRandomEthAddress(),
  ipfsMedia: description,
})


const getRandomDescrptiron = (length = 1000) => Array.from(Array(length)).map(() => Math.random().toString().slice(2, 3)).join('')