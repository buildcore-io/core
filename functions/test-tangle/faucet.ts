import { HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import { Network } from "../interfaces/models";
import { MnemonicService } from "../src/services/wallet/mnemonic";
import { SmrWallet } from "../src/services/wallet/SmrWalletService";
import { AddressDetails, WalletService } from "../src/services/wallet/wallet";
import { getRandomElement } from "../src/utils/common.utils";
import { wait } from "../test/controls/common";

export const getSenderAddress = async (network: Network, amountNeeded: number) => {
  const walletService = await WalletService.newWallet(network)
  const address = await walletService.getNewIotaAddressDetails()
  await requestFundsFromFaucet(network, address.bech32, amountNeeded)
  return address
}

export const requestFundsFromFaucet = async (network: Network, targetBech32: string, amount: number) => {
  const wallet = await WalletService.newWallet(network)
  const faucetAddress = await wallet.getIotaAddressDetails(getFaucetMnemonic(network))
  for (let i = 0; i < 600; ++i) {
    try {
      await MnemonicService.store(faucetAddress.bech32, faucetAddress.mnemonic, network);
      const blockId = await wallet.send(faucetAddress, targetBech32, amount)
      let ledgerInclusionState: string | undefined = undefined
      await wait(async () => {
        ledgerInclusionState = await wallet.getLedgerInclusionState(blockId)
        return ledgerInclusionState !== undefined
      })
      if (ledgerInclusionState === 'included') {
        return blockId
      }
    } catch (e) {
      console.log(e)
    } finally {
      await MnemonicService.store(faucetAddress.bech32, faucetAddress.mnemonic, network);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw Error('Could not get amount from faucet')
}

export const requestMintedTokenFromFaucet = async (wallet: SmrWallet, targetAddress: AddressDetails, tokenId: string, vaultMnemonic: string, amount = 20) => {
  for (let i = 0; i < 600; ++i) {
    try {
      const vaultAddress = await wallet.getIotaAddressDetails(vaultMnemonic)
      await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic, Network.RMS);
      const blockId = await wallet.send(vaultAddress, targetAddress.bech32, 0, {
        nativeTokens: [{ id: tokenId, amount: HexHelper.fromBigInt256(bigInt(amount)) }],
        storageDepositSourceAddress: targetAddress.bech32,
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
    } finally {
      await MnemonicService.store(targetAddress.bech32, targetAddress.mnemonic, Network.RMS);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw Error('Could not get native tokens from faucet')
}

export const getFaucetMnemonic = (network: Network) => getRandomElement(network === Network.ATOI ? ATOI_FAUCET_MNEMONIC : RMS_FAUCET_MNEMONIC)

const RMS_FAUCET_MNEMONIC = [
  'design uphold three apart danger beyond amount west useless ocean negative maid alarm clarify various balance stand below toast quality wide potato secret various',
  'conduct attract various model wet steak skull tattoo chuckle nature prefer ceiling ship appear merge minute verify tube cool trigger aerobic bracket remain cactus'
]

const ATOI_FAUCET_MNEMONIC = [
  'pet juice option plate thumb effort soon basket bamboo bunker jealous soccer slide strong chief truth sample govern powder rotate deny pill coyote loud',
  'vanish service neck hybrid off you lesson joke cliff twice ship throw vital symbol pride bus slam cram current post very baby item weekend'
]
