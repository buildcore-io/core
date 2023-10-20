import { Network, Timestamp } from '@build-5/interfaces';

import { Client } from '@iota/sdk';
import { MnemonicService } from '../src/services/wallet/mnemonic';
import { Wallet } from '../src/services/wallet/wallet';
import { AddressDetails } from '../src/services/wallet/wallet.service';
import { getRandomElement } from '../src/utils/common.utils';
import { wait } from '../test/controls/common';
import { getWallet } from '../test/set-up';

export const getSenderAddress = async (network: Network, amountNeeded: number) => {
  const walletService = await getWallet(network);
  const address = await walletService.getNewIotaAddressDetails();
  await requestFundsFromFaucet(network, address.bech32, amountNeeded);
  return address;
};

export const requestFundsFromFaucet = async (
  network: Network,
  targetBech32: string,
  amount: number,
  expiresAt?: Timestamp,
) => {
  const wallet = await getWallet(network);
  for (let i = 0; i < 600; ++i) {
    const faucetAddress = await wallet.getIotaAddressDetails(getFaucetMnemonic(network));
    try {
      await MnemonicService.store(faucetAddress.bech32, faucetAddress.mnemonic, network);
      const blockId = await wallet.send(faucetAddress, targetBech32, amount, {
        expiration: expiresAt
          ? { expiresAt, returnAddressBech32: faucetAddress.bech32 }
          : undefined,
      });
      const ledgerInclusionState = await awaitLedgerInclusionState(blockId);
      if (ledgerInclusionState === 'included') {
        return { blockId, faucetAddress };
      }
    } catch (e) {
      console.log(e);
    } finally {
      await MnemonicService.store(faucetAddress.bech32, faucetAddress.mnemonic, network);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 1500 + 500)));
  }
  throw Error('Could not get amount from faucet');
};

export const requestFundsForManyFromFaucet = async (
  network: Network,
  targets: { toAddress: string; amount: number; customMetadata?: any }[],
) => {
  const wallet = await getWallet(network);
  for (let i = 0; i < 600; ++i) {
    const faucetAddress = await wallet.getIotaAddressDetails(getFaucetMnemonic(network));
    try {
      await MnemonicService.store(faucetAddress.bech32, faucetAddress.mnemonic, network);
      const blockId = await wallet.sendToMany(faucetAddress, targets, {});
      const ledgerInclusionState = await awaitLedgerInclusionState(blockId);
      if (ledgerInclusionState === 'included') {
        return blockId;
      }
    } catch (e) {
      console.log(e);
    } finally {
      await MnemonicService.store(faucetAddress.bech32, faucetAddress.mnemonic, network);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 1500 + 500)));
  }
  throw Error('Could not get amount from faucet');
};

export const requestMintedTokenFromFaucet = async (
  wallet: Wallet,
  targetAddress: AddressDetails,
  tokenId: string,
  vaultMnemonic: string,
  amount = 20,
  expiresAt?: Timestamp,
) => {
  for (let i = 0; i < 600; ++i) {
    try {
      const vaultAddress = await wallet.getIotaAddressDetails(vaultMnemonic);
      await MnemonicService.store(vaultAddress.bech32, vaultAddress.mnemonic, Network.RMS);
      const blockId = await wallet.send(vaultAddress, targetAddress.bech32, 0, {
        expiration: expiresAt ? { expiresAt, returnAddressBech32: vaultAddress.bech32 } : undefined,
        nativeTokens: [{ id: tokenId, amount: BigInt(amount) }],
        storageDepositSourceAddress: targetAddress.bech32,
      });
      const ledgerInclusionState = await awaitLedgerInclusionState(blockId);
      if (ledgerInclusionState === 'included') {
        return blockId;
      }
    } catch {
      // do nothing
    } finally {
      await MnemonicService.store(targetAddress.bech32, targetAddress.mnemonic, Network.RMS);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 1500 + 500)));
  }
  throw Error('Could not get native tokens from faucet');
};

export const awaitLedgerInclusionState = async (blockId: string) => {
  let ledgerInclusionState: string | undefined = '';
  const client = new Client({ nodes: ['https://api.testnet.shimmer.network'] });
  await wait(async () => {
    ledgerInclusionState = await getLedgerInclusionState(client, blockId);
    return ledgerInclusionState !== undefined;
  }, 120);
  await client.destroy();
  return ledgerInclusionState;
};

const getLedgerInclusionState = async (client: Client, blockId: string) =>
  (await client.getBlockMetadata(blockId)).ledgerInclusionState;

export const getFaucetMnemonic = (network: Network) =>
  getRandomElement(network === Network.ATOI ? ATOI_FAUCET_MNEMONIC : RMS_FAUCET_MNEMONIC);

export const RMS_FAUCET_MNEMONIC = [
  'elevator eternal dumb mobile gesture valve cage ice sponsor ankle broken almost dilemma dish tissue shuffle purity phone baby palace turn tenant spy lonely',
  'master pretty hire genuine citizen protect leaf fantasy helmet supply priority olive minor push regular gravity afford canvas eight what glow mercy rally outdoor',
  'tomorrow flavor question luggage genuine victory manage unusual egg glance image author know error frost van dwarf decline sort treat more control token loan',
  'struggle glory express rocket soup oil trash apology husband creek armed forward razor elephant express canvas mom average spot jealous adjust will coyote brown',
  'address wheel reunion bounce achieve decorate vote wreck pudding they decline burden episode sure decline tail scatter humble vibrant apology skirt exclude typical win',
  'decide secret sort warm action front off swap patrol lizard dance anger blade club relief unhappy problem arena private margin ice mammal round merit',
  'island display radar churn alarm clog sword around wink ready ocean book saddle shift pig dentist wide wrestle initial toe category teach menu universe',
  'divert seat magnet surface cancel sibling bullet vast claw nuclear antique drink blast roof medal scare bean credit section frost arrow sugar elegant crucial',
  'lift estate accuse meat soft outer mushroom lecture duck between broccoli public girl misery leaf thing entry talk face program drop lyrics menu pave',
  'review fitness crouch abandon mandate any lesson rail dress narrow network unhappy ridge assume banner side person must month uncle genuine shove mixed affair',
  'surround park sting high spray reduce wing opinion distance joy other isolate length analyst follow fossil whip used favorite gauge vital live citizen theme',
  'run quality zone table portion initial decorate forward gift include dumb silver vacant grape action lucky stock fashion thrive notable photo copper mean cushion',
  'scissors pelican coin skill swim youth this sibling basic melody salad pole glass idea alpha derive brick rice mention north zone rhythm shield noise',
  'arrow vote destroy advance dizzy digital forum library shaft blame seven canoe deer curtain umbrella grief sibling drum dial crisp brown crop aisle catalog',
  'dry detect moral dawn tip now still blame peace stadium agent minimum ice alarm capable amateur hospital uncover wheat forget fence valley sustain lunch',
  'ranch castle visa syrup famous mercy primary buddy slim vintage sting wonder fury corn vacant absent once cart waste pluck either stand picture thank',
  'orient math boat embrace despair glass desert toast under vendor letter antique city original essence eagle address paddle pioneer crew liberty strike tragic actress',
];
export const ATOI_FAUCET_MNEMONIC = RMS_FAUCET_MNEMONIC;
