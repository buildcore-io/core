import dayjs from "dayjs"
import { Categories, Collection, CollectionStatus, CollectionType, Member, Network, Space, Transaction, TransactionChangeNftOrderType, TransactionType } from "../interfaces/models"
import { Access, COL } from "../interfaces/models/base"
import { Nft, NftStatus } from "../interfaces/models/nft"
import admin from "../src/admin.config"
import { approveCollection, createCollection } from "../src/controls/collection.control"
import { mintCollectionOrder } from '../src/controls/nft/collection-mint.control'
import { createNft, depositNft, withdrawNft } from "../src/controls/nft/nft.control"
import { orderNft } from "../src/controls/order.control"
import { SmrWallet } from "../src/services/wallet/SmrWalletService"
import { WalletService } from "../src/services/wallet/wallet"
import { getAddress } from "../src/utils/address.utils"
import { serverTime } from "../src/utils/dateTime.utils"
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
  let walletService: SmrWallet

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listenerRMS = new MilestoneListener(network)
    walletService = await WalletService.newWallet(network) as SmrWallet
  })

  beforeEach(async () => {
    guardian = await createMemberTest(walletSpy)
    space = await createSpace(walletSpy, guardian)

    mockWalletReturnValue(walletSpy, guardian, createDummyCollection(space.uid));
    collection = (await testEnv.wrap(createCollection)({})).uid;

    mockWalletReturnValue(walletSpy, guardian, { uid: collection });
    await testEnv.wrap(approveCollection)({});
  })

  const createAndOrderNft = async () => {
    let nft: any = { media: MEDIA, ...createDummyNft(collection) }
    delete nft.uid
    mockWalletReturnValue(walletSpy, guardian, nft);
    nft = await testEnv.wrap(createNft)({});

    await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).update({ availableFrom: dayjs().subtract(1, 'h').toDate() })

    mockWalletReturnValue(walletSpy, guardian, { collection, nft: nft.uid });
    const order = await testEnv.wrap(orderNft)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

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
    expect(collectionData.mintingData?.address).toBe('')
    expect(collectionData.mintingData?.nftsToMint).toBe(0)

    const ownerChangeTran = (await admin.firestore().collection(COL.TRANSACTION)
      .where('payload.type', '==', TransactionChangeNftOrderType.SEND_COLLECTION_NFT_TO_GUARDIAN)
      .where('member', '==', guardian)
      .get()).docs.map(d => <Transaction>d.data())

    expect(ownerChangeTran.length).toBe(1)
    expect(ownerChangeTran[0].payload?.walletReference?.confirmed).toBe(true)
  }

  const updateGuardianAddress = (address: string) =>
    admin.firestore().doc(`${COL.MEMBER}/${guardian}`).update({ [`validatedAddress.${network}`]: address })

  const sendNftToAddress = async (sourceAddress: string, targetAddress: string) => {
    const order = <Transaction>{
      type: TransactionType.CHANGE_NFT_OWNER,
      uid: getRandomEthAddress(),
      member: guardian,
      createdOn: serverTime(),
      network: network,
      payload: { sourceAddress, targetAddress }
    }
    await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).create(order)
  }

  it('Should withdraw minted nft and deposit it back', async () => {
    let nft = await createAndOrderNft()
    await mintCollection()
    const tmpAddress = await walletService.getNewIotaAddressDetails()
    await updateGuardianAddress(tmpAddress.bech32)

    mockWalletReturnValue(walletSpy, guardian, { nft: nft.uid })
    await testEnv.wrap(withdrawNft)({})
    const query = admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CHANGE_NFT_OWNER)
      .where('payload.nft', '==', nft.uid)
    await wait(async () => {
      const snap = await query.get()
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed
    })
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`)
    nft = <Nft>(await nftDocRef.get()).data()
    expect(nft.status).toBe(NftStatus.WITHDRAWN)
    expect(nft.hidden).toBe(true)
    expect(nft.mintingData).toBeUndefined()

    const wallet = await WalletService.newWallet(network) as SmrWallet
    const guardianData = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${guardian}`).get()).data()
    let outputs = await wallet.getNftOutputs(undefined, getAddress(guardianData, network))
    expect(Object.keys(outputs).length).toBe(1)

    mockWalletReturnValue(walletSpy, guardian, { network })
    const depositOrder = await testEnv.wrap(depositNft)({})

    await sendNftToAddress(getAddress(guardianData, network), depositOrder.payload.targetAddress)

    await wait(async () => {
      nft = <Nft>(await nftDocRef.get()).data()
      return nft.status === NftStatus.MINTED
    })
    expect(nft.mintingData?.storageDeposit).toBe(Number(Object.values(outputs)[0].amount))
    expect(nft.mintingData?.address).toBe(depositOrder.payload.targetAddress)
    expect(nft.mintingData?.mintedBy).toBe(guardian)
    expect(nft.mintingData?.network).toBe(network)
    expect(nft.hidden).toBe(false)

    outputs = await wallet.getNftOutputs(undefined, getAddress(guardianData, network))
    expect(Object.keys(outputs).length).toBe(0)
  })

  const withdrawNftAndAwait = async (nft: string) => {
    mockWalletReturnValue(walletSpy, guardian, { nft })
    await testEnv.wrap(withdrawNft)({})
    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TRANSACTION)
        .where('payload.type', '==', TransactionChangeNftOrderType.WITHDRAW_NFT)
        .where('payload.nft', '==', nft)
        .get()
      return snap.docs[0].data()?.payload?.walletReference?.confirmed
    })
  }

  it('Should credit second nft sent to the same address', async () => {
    const nft1 = await createAndOrderNft()
    const nft2 = await createAndOrderNft()
    await mintCollection()

    const tmpAddress1 = await walletService.getNewIotaAddressDetails()
    await updateGuardianAddress(tmpAddress1.bech32)
    await withdrawNftAndAwait(nft1.uid)

    const tmpAddress2 = await walletService.getNewIotaAddressDetails()
    await updateGuardianAddress(tmpAddress2.bech32)
    await withdrawNftAndAwait(nft2.uid)

    mockWalletReturnValue(walletSpy, guardian, { network })
    const depositOrder = await testEnv.wrap(depositNft)({})

    const promises = [
      sendNftToAddress(tmpAddress1.bech32, depositOrder.payload.targetAddress),
      sendNftToAddress(tmpAddress2.bech32, depositOrder.payload.targetAddress)
    ]
    await Promise.all(promises)

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT_NFT)
        .where('member', '==', guardian)
        .get()
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed
    })
  })

  it('Should credit invalid nft', async () => {
    const nft = await createAndOrderNft()
    await mintCollection()

    const tmpAddress1 = await walletService.getNewIotaAddressDetails()
    await updateGuardianAddress(tmpAddress1.bech32)
    await withdrawNftAndAwait(nft.uid)

    await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).delete()

    mockWalletReturnValue(walletSpy, guardian, { network })
    const depositOrder = await testEnv.wrap(depositNft)({})

    await sendNftToAddress(tmpAddress1.bech32, depositOrder.payload.targetAddress)

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT_NFT)
        .where('member', '==', guardian)
        .get()
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed
    })
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
