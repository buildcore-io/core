import { COL } from "../../interfaces/models/base"
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

  it.each([false, true])('Should mint collection with no nfts', async (limited: boolean) => {
    if (limited) {
      await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).update({ limitedEdition: limited })
    }
    await helper.mintCollection()
    if (limited) {
      await helper.lockCollectionConfirmed()
    }
  })

  afterAll(async () => {
    await helper.afterAll()
  })
})
