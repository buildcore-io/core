import { Network } from "../interfaces/models";
import { MnemonicService } from "../src/services/wallet/mnemonic";
import { WalletService } from "../src/services/wallet/wallet";
import { wait } from "../test/controls/common";
import { FAUCET_MNEMONIC } from "../test/set-up";

export const getSenderAddress = async (network: Network, amountNeeded: number) => {
  const walletService = WalletService.newWallet(network)
  const address = await walletService.getNewIotaAddressDetails()
  await MnemonicService.store(address.bech32, address.mnemonic, network)
  await requestFundsFromFaucet(network, address.bech32, amountNeeded)
  return address
}

export const requestFundsFromFaucet = async (network: Network, targetAddress: string, amount: number) => {
  const walletService = WalletService.newWallet(network)
  const faucetAddress = await walletService.getIotaAddressDetails(FAUCET_MNEMONIC)
  await walletService.sendFromGenesis(faucetAddress, targetAddress, amount, '')
  await wait(async () => (await walletService.getBalance(targetAddress)) !== 0)
}
