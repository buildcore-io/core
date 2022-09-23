import { DEFAULT_NETWORK, MIN_IOTA_AMOUNT } from "../../interfaces/config"
import { Member, Transaction, TransactionType } from "../../interfaces/models"
import { COL } from "../../interfaces/models/base"
import { Nft, NftStatus } from "../../interfaces/models/nft"
import admin from "../../src/admin.config"
import { getAddress } from "../../src/utils/address.utils"
import { CollectionMintHelper } from "./common"


describe('Collection minting', () => {
  const helper = new CollectionMintHelper()

  beforeAll(async () => {
    await helper.beforeAll()
  })

  beforeEach(async () => {
    await helper.beforeEach()
  })

  it('Should mint, cancel active sells, not mint placeholder', async () => {
    await helper.createAndOrderNft()
    await helper.createAndOrderNft(true)
    const nft = await helper.createAndOrderNft(true, true)
    let placeholderNft = await helper.createAndOrderNft(true, false)
    await admin.firestore().doc(`${COL.NFT}/${placeholderNft.uid}`).update({ placeholderNft: true })
    await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).update({ total: admin.firestore.FieldValue.increment(-1) })

    await helper.mintCollection()

    const bidCredit = (await admin.firestore().collection(COL.TRANSACTION)
      .where('payload.collection', '==', helper.collection)
      .where('type', '==', TransactionType.CREDIT)
      .get()).docs.map(d => <Transaction>d.data())
    expect(bidCredit.length).toBe(1)
    expect(bidCredit[0].payload.amount).toBe(2 * MIN_IOTA_AMOUNT)
    const bidder = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${helper.member}`).get()).data()
    const order = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${nft.auctionHighestTransaction}`).get()).data()
    expect(bidCredit[0].payload.targetAddress).toBe(getAddress(bidder, DEFAULT_NETWORK))
    expect(bidCredit[0].payload.sourceAddress).toBe(order.payload.targetAddress)

    const nftsQuery = admin.firestore().collection(COL.NFT).where('collection', '==', helper.collection).where('placeholderNft', '==', 'false')
    const nfts = (await nftsQuery.get()).docs.map(d => <Nft>d.data())
    const allCancelled = nfts.reduce((acc, act) => acc && (
      act.auctionFrom === null &&
      act.auctionTo === null &&
      act.auctionFloorPrice === null &&
      act.auctionLength === null &&
      act.auctionHighestBid === null &&
      act.auctionHighestBidder === null &&
      act.auctionHighestTransaction === null
    ) && (!act.sold || (act.availableFrom === null && act.availablePrice === null)), true)
    expect(allCancelled).toBe(true)
    for (const nft of nfts) {
      const nftOutputs = await helper.nftWallet!.getNftOutputs(nft.mintingData?.nftId, undefined)
      expect(Object.keys(nftOutputs).length).toBe(1)
      const metadata = helper.getNftMetadata(Object.values(nftOutputs)[0])
      expect(metadata.soonaverse.uid).toBe(nft.uid)
      expect(metadata.soonaverse.space).toBe(nft.space)
      expect(metadata.soonaverse.collection).toBe(nft.collection)
      expect(metadata.uri).toBe(nft.url || '')
      expect(metadata.name).toBe(nft.name)
      expect(metadata.description).toBe(nft.description)
    }

    placeholderNft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${placeholderNft.uid}`).get()).data()
    expect(placeholderNft.status).toBe(NftStatus.PRE_MINTED)
  })

  it('Should unlock locked nft', async () => {
    let lockedNft = await helper.createLockedNft()
  
    await helper.mintCollection()
  
    const lockedNftOrder = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${lockedNft.lockedBy}`).get()).data()
    expect(lockedNftOrder.payload.void).toBe(true)
  
    lockedNft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${lockedNft.uid}`).get()).data()
    expect(lockedNft.locked).toBe(false)
    expect(lockedNft.lockedBy).toBe(null)
    expect(lockedNft.mintingData).toBeDefined()
    expect(lockedNft.status).toBe(NftStatus.MINTED)
  })

  afterAll(async () => {
    await helper.afterAll()
  })
})
