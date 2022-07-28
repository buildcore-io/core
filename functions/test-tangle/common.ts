import { SingleNodeClient } from "@iota/iota.js-next"
import { Network } from "../interfaces/models"
import { COL } from "../interfaces/models/base"
import admin from "../src/admin.config"
import { WalletService } from "../src/services/wallet/wallet"

export const addValidatedAddress = async (network: Network, member: string) => {
  const walletService = WalletService.newWallet(network)
  const address = await walletService.getNewIotaAddressDetails()
  await admin.firestore().doc(`${COL.MEMBER}/${member}`).update({ [`validatedAddress.${network}`]: address.bech32 })
  return address
}

export const waitForBlockToBeIncluded = async (client: SingleNodeClient, blockId: string) => {
  for (let i = 0; i < 120; ++i) {
    const metadata = await client.blockMetadata(blockId)
    if (!metadata.ledgerInclusionState) {
      await new Promise(resolve => setTimeout(resolve, 500));
      continue
    }
    if (metadata.ledgerInclusionState === 'included') {
      return
    }
    throw new Error('Block inclusion error: ' + blockId)
  }
  throw new Error('Block was not included: ' + blockId)
}
