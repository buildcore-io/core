import { UnsoldMintingOptions } from "../../interfaces/models"
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

  it('Should hide placeholder nft, all are sold before mint', async () => {
    await helper.createAndOrderNft(true, true)
    let placeholderNft = await helper.createAndOrderNft(true, false)
    await admin.firestore().doc(`${COL.NFT}/${placeholderNft.uid}`).update({ placeholderNft: true })
    await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).update({ total: admin.firestore.FieldValue.increment(-1) })

    await helper.mintCollection()

    placeholderNft = <Nft>(await admin.firestore().doc(`${COL.NFT}/${placeholderNft.uid}`).get()).data()
    expect(placeholderNft.hidden).toBe(true)
  })

  afterAll(async () => {
    await helper.afterAll()
  })
})
