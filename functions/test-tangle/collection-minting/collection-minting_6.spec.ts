import { Collection, UnsoldMintingOptions } from "../../interfaces/models"
import { COL } from "../../interfaces/models/base"
import { Nft } from "../../interfaces/models/nft"
import admin from "../../src/admin.config"
import { CollectionMintHelper } from "./common"


describe('Collection minting', () => {
  const helper = new CollectionMintHelper()

  beforeAll(async () => {
    await helper.beforeAll()
  })

  beforeEach(async () => {
    await helper.beforeEach()
  })

  it.each([UnsoldMintingOptions.BURN_UNSOLD, UnsoldMintingOptions.KEEP_PRICE])('Should burn unsold nfts', async (unsoldMintingOptions: UnsoldMintingOptions) => {
    let nft = <Nft | undefined>(await helper.createAndOrderNft())
    let collectionData = <Collection>(await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).get()).data()
    expect(collectionData.total).toBe(1)

    await helper.mintCollection(unsoldMintingOptions)

    collectionData = <Collection>(await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).get()).data()
    expect(collectionData.total).toBe(unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD ? 0 : 1)
    nft = <Nft | undefined>(await admin.firestore().doc(`${COL.NFT}/${nft?.uid}`).get()).data()
    expect(nft === undefined).toBe(unsoldMintingOptions === UnsoldMintingOptions.BURN_UNSOLD)
  })

  afterAll(async () => {
    await helper.afterAll()
  })
})
