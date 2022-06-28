import { MIN_IOTA_AMOUNT } from "../interfaces/config";
import { Network } from "../interfaces/models";
import { MnemonicService } from "../src/services/wallet/mnemonic";
import { AddressDetails, WalletService } from "../src/services/wallet/wallet";
import { wait } from "../test/controls/common";

const getUrl = (network: Network) => {
  switch (network) {
    case Network.RMS:
      return 'https://faucet.alphanet.iotaledger.net/api/enqueue'
    default:
      return 'https://faucet.chrysalis-devnet.iota.cafe/api/plugins/faucet/enqueue'
  }
}

export const getSenderAddress = async (network: Network, amountNeeded: number) => {
  const walletService = WalletService.newWallet(network)
  const address = await walletService.getNewIotaAddressDetails()
  await MnemonicService.store(address.bech32, address.mnemonic, network)
  await requestFromFaucetIfNotEnough(network, address, amountNeeded)
  return address
}

export const requestFromFaucetIfNotEnough = async (network: Network, address: AddressDetails, amount: number) => {
  const wallet = WalletService.newWallet(network)
  const balance = await wallet.getBalance(address.bech32)
  if (balance - amount < MIN_IOTA_AMOUNT) {
    console.log('Requesting tokens from faucet')
    await requestFundsFromFaucet(network, address)
  }
}

const requestFundsFromFaucet = async (network: Network, address: AddressDetails) => {
  const walletService = WalletService.newWallet(network)
  const data = { address: address.bech32 };
  const customHeaders = {
    "Content-Type": "application/json",
  }
  await fetch(getUrl(network), {
    method: "POST",
    headers: customHeaders,
    body: JSON.stringify(data),
  })

  await wait(async () => (await walletService.getBalance(address.bech32)) !== 0)
}
