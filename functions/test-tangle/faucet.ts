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
  await walletService.sendFromGenesis(faucetAddress, targetAddress, amount, '')
  await wait(async () => (await walletService.getBalance(targetAddress)) !== 0)
}

const getFaucetMnemonic = (network: Network) => network === Network.ATOI ? ATOI_FAUCET_MNEMONIC : RMS_FAUCET_MNEMONIC

const RMS_FAUCET_MNEMONIC = 'leave bitter execute problem must spray various try direct inhale elite lens era treat admit note rhythm brand lyrics guide warfare beyond genuine trip'
const ATOI_FAUCET_MNEMONIC = 'evil palace excess utility wear asset bid math harsh kiwi sketch sport imitate athlete tent enable guard garden romance gentle vacuum mystery online display'
