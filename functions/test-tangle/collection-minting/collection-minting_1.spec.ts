import { WenError } from "../../interfaces/errors"
import { UnsoldMintingOptions } from "../../interfaces/models"
import { COL } from "../../interfaces/models/base"
import admin from "../../src/admin.config"
import { mintCollectionOrder } from "../../src/controls/nft/collection-mint.control"
import { expectThrow, mockWalletReturnValue } from "../../test/controls/common"
import { testEnv } from "../../test/set-up"
import { CollectionMintHelper } from "./common"
import * as config from '../../src/utils/config.utils';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper()

  beforeAll(async () => {
    await helper.beforeAll()
  })

  beforeEach(async () => {
    await helper.beforeEach()
  })

  it('Should throw, no nfts', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection, network: helper.network, unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE
    })
    await expectThrow(testEnv.wrap(mintCollectionOrder)({}), WenError.no_nfts_to_mint.key)
  })
  
  it('Should throw, all nfts will be burned', async () => {
    await helper.createAndOrderNft()
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection, network: helper.network, unsoldMintingOptions: UnsoldMintingOptions.BURN_UNSOLD
    })
    await expectThrow(testEnv.wrap(mintCollectionOrder)({}), WenError.no_nfts_to_mint.key)
  })

  it('Should throw, no approved nfts', async () => {
    const nft = await helper.createAndOrderNft()
    await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).update({ approved: false })
    const isProdSpy = jest.spyOn(config, 'isProdEnv')
    isProdSpy.mockReturnValue(true)
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection, network: helper.network, unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE
    })
    await expectThrow(testEnv.wrap(mintCollectionOrder)({}), WenError.no_nfts_to_mint.key)
  })

  it('Should throw, collection not approved', async () => {
    await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).update({ approved: false })
    const isProdSpy = jest.spyOn(config, 'isProdEnv')
    isProdSpy.mockReturnValue(true)
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection, network: helper.network, unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE
    })
    await expectThrow(testEnv.wrap(mintCollectionOrder)({}), WenError.collection_must_be_approved.key)
  })

  afterAll(async () => {
    await helper.afterAll()
  })
})
