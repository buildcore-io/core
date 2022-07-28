import { Network } from "../interfaces/models";
import { WalletService } from "../src/services/wallet/wallet";
import { wait } from "../test/controls/common";
import { waitForBlockToBeIncluded } from "./common";

export const requestFundsFromFaucet = async (network: Network, targetBech32: string, amount: number) => {
  const wallet = WalletService.newWallet(network)
  for (let i = 0; i < 180; ++i) {
    try {
      const faucetAddress = await wallet.getIotaAddressDetails(getFaucetMnemonic(network))
      const blockId = await wallet.send(faucetAddress, targetBech32, amount)
      await wait(async () => {
        return await wallet.getLedgerInclusionState(blockId) !== undefined
      })
      const ledgerInclusionState = await wallet.getLedgerInclusionState(blockId)
      if (ledgerInclusionState === 'included') {
        return blockId
      }
    } catch {
      // do nothing
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error('Could not get amount from faucet')
}

export const getFaucetMnemonic = (network: Network) => network === Network.ATOI ? ATOI_FAUCET_MNEMONIC : RMS_FAUCET_MNEMONIC

export const RMS_FAUCET_MNEMONIC = 'design uphold three apart danger beyond amount west useless ocean negative maid alarm clarify various balance stand below toast quality wide potato secret various'
export const ATOI_FAUCET_MNEMONIC = 'pet juice option plate thumb effort soon basket bamboo bunker jealous soccer slide strong chief truth sample govern powder rotate deny pill coyote loud'

export const VAULT_MNEMONIC = 'march fetch female armor you mirror minute winner staff empty rose wrap describe girl security maple recipe scan rebel couch field job liar snap'
export const MINTED_TOKEN_ID = '0x087f3221adb3be9ef74a69595ef282b4ca47fd98b6bf1142e7d8f9f7b265efeedc0100000000'
