import { Network, NetworkAddress, Timestamp } from '@build-5/interfaces';
import { SingleNodeClient } from '@iota/iota.js';
import { SingleNodeClient as SingleNodeClientNext } from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import { SmrWallet } from '../src/services/wallet/SmrWalletService';
import { MnemonicService } from '../src/services/wallet/mnemonic';
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
  targets: { toAddress: NetworkAddress; amount: number; customMetadata?: any }[],
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

export const ATOI_FAUCET_MNEMONIC = [
  'silver depend civil pilot paper short learn island skill carpet fatal damp damp narrow captain industry pond lion utility reduce seed noble volcano table',
  'faint label strike still rapid auto later mesh grunt accuse gaze armed reject float fork dynamic ahead bright jar trouble drink neck open rebuild',
  'chief addict broccoli square swim cannon damp lyrics novel evidence web tree sadness frozen provide power echo chalk prosper seminar speak attack wedding magnet',
  'rather school always baby print wish worth fiscal lake pudding dial one warm bachelor lawsuit deposit pistol joke lemon rail dog night reform problem',
  'chronic future orchard remember ball exhibit salt ghost churn dream urban bicycle hurry home ugly harbor antenna blur sing flock crime turtle tackle volcano',
  'crowd patient puppy eternal weekend day ordinary ring runway rack ritual situate indoor glide smart act fetch safe creek disease corn voice legend viable',
  'daughter now organ owner stairs quarter used also soap quit online fitness label city palace unaware fall normal summer guard ship erase ride equip',
  'chat invest powder language marble still expire panther envelope fish animal sell rail drum lecture screen modify truth surface fashion visit smile impact action',
  'doctor virtual pipe casual sock escape matter demise tumble silent annual hazard basket section cheap proof horse spoil river surround vote found sustain ritual',
  'orange giant water leave glimpse below steel kick reward unique wealth index observe sure artist faint travel moral report destroy goose type theory sail',
  'zebra put acoustic okay goddess clip proud pumpkin join abandon manual uncover scatter outer fatal tilt perfect menu silent route pool disagree credit design',
  'renew wisdom goose fat satisfy trade expose era bright giraffe inhale occur bundle topic cactus parrot because remain kit leave dinner medal flash polar',
  'slot skirt bracket merit language excess deal rich surface kingdom reunion armor apple receive song man tag man need drama idea relax steel vague',
  'boost else leaf alpha shop inhale winner believe race scrap object scheme survey soon carpet pupil cloud odor dove blind palace thank run tribe',
  'exist protect clown gown search document weasel next reveal battle excite only surround lottery leopard found history bicycle cattle deputy text utility soccer bacon',
  'brown improve asset above fall embrace baby tackle fiber physical keep decide club convince increase three day century today enrich naive melody ethics jungle',
  'quantum detect embody assist property judge rent east brain better more false blame table usual excess absent tragic token post unaware topic wrap phone',
  'sea panel float tongue mention scrap can typical student section cattle neck bid artwork echo online motion desk chalk fog tail beauty pitch fame',
  'whisper budget cup recycle upper jealous still unusual purpose charge twist deposit photo utility online gravity ten reject print unfair price opinion chair impulse',
  'dilemma dry emerge tray little dry muffin solid math boil health bulb teach marine grace method smile torch attract brave almost exotic cost direct',
  'seminar own leaf fluid avoid like pelican issue remind cradle topple island control parade brass wealth orange place media rebel lumber camera miss item',
  'task eager same nerve board icon design trigger enlist blanket humble about april curious venue bounce flip old damage delay help clinic primary science',
  'embark warm hen face helmet gauge extend quantum mandate oven unfair announce audit blanket ball like drift pigeon caution dumb error doll apart remain',
  'island crucial frequent attitude error hard sock first crazy symbol soldier theme south when impact shuffle pause aerobic truck marine bike arrow turtle unit',
  'diagram blame cabin battle vacuum goddess weird develop turn symbol sight dance trap loop sample culture purse pupil hobby deal wheel neglect behind tongue',
];

const publicRmsClient = new SingleNodeClientNext('https://api.testnet.shimmer.network');
const publicAtoiClient = new SingleNodeClient('https://api.lb-0.h.chrysalis-devnet.iota.cafe/');
