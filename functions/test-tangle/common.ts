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
