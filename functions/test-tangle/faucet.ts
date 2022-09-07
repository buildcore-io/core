import { HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import { Network } from "../interfaces/models";
import { SmrWallet } from "../src/services/wallet/SmrWalletService";
import { WalletService } from "../src/services/wallet/wallet";
import { wait } from "../test/controls/common";

export const getSenderAddress = async (network: Network, amountNeeded: number) => {
  const walletService = await WalletService.newWallet(network)
  const address = await walletService.getNewIotaAddressDetails()
  await requestFundsFromFaucet(network, address.bech32, amountNeeded)
  return address
}

export const requestFundsFromFaucet = async (network: Network, targetBech32: string, amount: number) => {
  const wallet = await WalletService.newWallet(network)
  for (let i = 0; i < 600; ++i) {
    try {
      const faucetAddress = await wallet.getIotaAddressDetails(getFaucetMnemonic(network))
      const blockId = await wallet.send(faucetAddress, targetBech32, amount)
      let ledgerInclusionState: string | undefined = undefined
      await wait(async () => {
        ledgerInclusionState = await wallet.getLedgerInclusionState(blockId)
        return ledgerInclusionState !== undefined
      })
      if (ledgerInclusionState === 'included') {
        return blockId
      }
    } catch {
      // do nothing
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw Error('Could not get amount from faucet')
}

export const requestMintedTokenFromFaucet = async (wallet: SmrWallet, targetAddress: string, tokenId: string, vaultMnemonic: string) => {
  for (let i = 0; i < 600; ++i) {
    try {
      const vaultAddress = await wallet.getIotaAddressDetails(vaultMnemonic)
      const blockId = await wallet.send(vaultAddress, targetAddress, 0, {
        nativeTokens: [{ id: tokenId, amount: HexHelper.fromBigInt256(bigInt(20)) }],
        storageDepositSourceAddress: targetAddress,
      })
      let ledgerInclusionState: string | undefined = undefined
      await wait(async () => {
        ledgerInclusionState = await wallet.getLedgerInclusionState(blockId)
        return ledgerInclusionState !== undefined
      })
      if (ledgerInclusionState === 'included') {
        return blockId
      }
    } catch {
      // do nothing
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw Error('Could not get native tokens from faucet')
}

const getFaucetMnemonic = (network: Network) => network === Network.ATOI ? ATOI_FAUCET_MNEMONIC : RMS_FAUCET_MNEMONIC

export const RMS_FAUCET_MNEMONIC = 'design uphold three apart danger beyond amount west useless ocean negative maid alarm clarify various balance stand below toast quality wide potato secret various'
export const ATOI_FAUCET_MNEMONIC = 'pet juice option plate thumb effort soon basket bamboo bunker jealous soccer slide strong chief truth sample govern powder rotate deny pill coyote loud'
