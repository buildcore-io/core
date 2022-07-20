import { Network } from "../interfaces/models";
import { MnemonicService } from "../src/services/wallet/mnemonic";
import { WalletService } from "../src/services/wallet/wallet";
import { wait } from "../test/controls/common";

export const getSenderAddress = async (network: Network, amountNeeded: number) => {
  const walletService = WalletService.newWallet(network)
  const address = await walletService.getNewIotaAddressDetails()
  await MnemonicService.store(address.bech32, address.mnemonic, network)
  await requestFundsFromFaucet(network, address.bech32, amountNeeded)
  return address
}

export const requestFundsFromFaucet = async (network: Network, targetAddress: string, amount: number) => {
  const walletService = WalletService.newWallet(network)
  const faucetAddress = await walletService.getIotaAddressDetails(getFaucetMnemonic(network))
  await walletService.send(faucetAddress, targetAddress, amount, '')
  await wait(async () => (await walletService.getBalance(targetAddress)) !== 0)
}

const getFaucetMnemonic = (network: Network) => network === Network.ATOI ? ATOI_FAUCET_MNEMONIC : RMS_FAUCET_MNEMONIC

export const RMS_FAUCET_MNEMONIC = 'design uphold three apart danger beyond amount west useless ocean negative maid alarm clarify various balance stand below toast quality wide potato secret various'
export const ATOI_FAUCET_MNEMONIC = 'pet juice option plate thumb effort soon basket bamboo bunker jealous soccer slide strong chief truth sample govern powder rotate deny pill coyote loud'
