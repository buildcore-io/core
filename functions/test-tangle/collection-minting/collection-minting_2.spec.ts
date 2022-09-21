import { isEmpty } from "lodash"
import { TransactionMintCollectionType, TransactionType } from "../../interfaces/models"
import { COL } from "../../interfaces/models/base"
import { Nft, NftStatus } from "../../interfaces/models/nft"
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

  it.each([false])('Should mint collection with many nfts', async (limited: boolean) => {
    if (limited) {
      await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).update({ limitedEdition: limited })
    }
    const count = 100
    await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).update({ total: count })
    const promises = Array.from(Array(count)).map(() => {
      const nft = helper.createDummyNft(helper.collection!)
      return admin.firestore().doc(`${COL.NFT}/${nft.uid}`).create(nft)
    })
    await Promise.all(promises)

    await helper.mintCollection()
    if (limited) {
      await helper.lockCollectionConfirmed()
    }

    const nftMintSnap = await admin.firestore().collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.MINT_COLLECTION)
      .where('payload.type', '==', TransactionMintCollectionType.MINT_NFTS)
      .where('payload.collection', '==', helper.collection)
      .get()
    expect(nftMintSnap.size).toBeGreaterThan(1)

    const nfts = (await admin.firestore().collection(COL.NFT).where('collection', '==', helper.collection).get()).docs.map(d => <Nft>d.data())
    const allMinted = nfts.reduce((acc, act) => acc && act.status === NftStatus.MINTED, true)
    expect(allMinted).toBe(true)
    const allMintedByGuardian = nfts.reduce((acc, act) => acc && act.mintingData?.mintedBy === helper.guardian, true)
    expect(allMintedByGuardian).toBe(true)
    const allHaveAddress = nfts.reduce((acc, act) => acc && !isEmpty(act.mintingData?.address), true)
    expect(allHaveAddress).toBe(true)
    const allHaveStorageDepositSaved = nfts.reduce((acc, act) => acc && act.mintingData?.storageDeposit !== undefined, true)
    expect(allHaveStorageDepositSaved).toBe(true)
  })

  afterAll(async () => {
    await helper.afterAll()
  })
})
