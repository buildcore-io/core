import { SingleNodeClient } from '@iota/iota.js';
import { SingleNodeClient as SingleNodeClientNext } from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import { Network, Timestamp } from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import { MnemonicService } from '../src/services/wallet/mnemonic';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../src/services/wallet/wallet';
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
      const ledgerInclusionState = await awaitLedgerInclusionState(blockId, network);
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
      const ledgerInclusionState = await awaitLedgerInclusionState(blockId, network);
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
  wallet: SmrWallet,
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
        nativeTokens: [{ id: tokenId, amount: HexHelper.fromBigInt256(bigInt(amount)) }],
        storageDepositSourceAddress: targetAddress.bech32,
      });
      const ledgerInclusionState = await awaitLedgerInclusionState(blockId, Network.RMS);
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

export const awaitLedgerInclusionState = async (blockId: string, network: Network) => {
  let ledgerInclusionState: string | undefined = '';
  await wait(async () => {
    ledgerInclusionState = await getLedgerInclusionState(blockId, network);
    return ledgerInclusionState !== undefined;
  }, 120);
  return ledgerInclusionState;
};

const getLedgerInclusionState = async (blockId: string, network: Network) => {
  if (network === Network.RMS) {
    return (await publicRmsClient.blockMetadata(blockId)).ledgerInclusionState;
  }
  return (await publicAtoiClient.messageMetadata(blockId)).ledgerInclusionState;
};

export const getFaucetMnemonic = (network: Network) =>
  getRandomElement(network === Network.ATOI ? ATOI_FAUCET_MNEMONIC : RMS_FAUCET_MNEMONIC);

export const RMS_FAUCET_MNEMONIC = [
  'design uphold three apart danger beyond amount west useless ocean negative maid alarm clarify various balance stand below toast quality wide potato secret various',
  'conduct attract various model wet steak skull tattoo chuckle nature prefer ceiling ship appear merge minute verify tube cool trigger aerobic bracket remain cactus',
  'phrase shuffle athlete muscle truck will reward proud spread much decide olympic liquid embark female maze carpet process secret learn sudden runway original syrup',
  'round color answer whale employ over spell ribbon speed ranch aunt canoe shiver accuse pupil roof differ gorilla lumber inject kid cat nuclear solution',
  'fine awkward embrace crunch amount raw dilemma advance hire hybrid remove alter kit best mixed general prize apology blind armor enhance fantasy drop palm',
  'position invest that across kite leisure avocado eight midnight improve cabin female digital educate client pitch regular verify unknown nuclear confirm like harvest wood',
  'van tobacco flock myth address guard transfer brother process reward gauge neck ensure mosquito smart cave snack differ renew shove jar possible hybrid spawn',
  'expose journey brief excite year hawk oyster myself lobster paper tired body razor skate gentle joy dinosaur aunt fork staff weird whisper jar daring',
];

export const ATOI_FAUCET_MNEMONIC = [
  'pet juice option plate thumb effort soon basket bamboo bunker jealous soccer slide strong chief truth sample govern powder rotate deny pill coyote loud',
  'vanish service neck hybrid off you lesson joke cliff twice ship throw vital symbol pride bus slam cram current post very baby item weekend',
  'isolate object path clock strike grant spell output used private chapter scout express trumpet penalty weapon cause brown soup judge alert hammer year mystery',
  'base wide glad finish garbage someone school airport merge only meadow devote session wonder proof derive yellow trust cigar rude develop remain shoulder flip',
  'party cross start burst cloth kingdom remove mistake royal churn search gold match artefact blouse address twenty wall pony smart copper seat heavy quantum',
  'arch asthma pepper lunar start good caught hair dynamic robust cause tilt together supply biology energy cancel plunge butter grace wish kite enroll abandon',
  'path child shove injury solid parent aerobic method rubber resist rent regret ketchup differ speak scale feed weekend pet loop scale odor arctic fetch',
  'gadget drill doctor equip vault entire birth palace badge struggle burger useless lottery oil ribbon rhythm half enemy foot action pigeon squeeze sign machine',
];

const publicRmsClient = new SingleNodeClientNext('https://api.testnet.shimmer.network');
const publicAtoiClient = new SingleNodeClient('https://api.lb-0.h.chrysalis-devnet.iota.cafe/');
