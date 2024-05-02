import { database } from '@buildcore/database';
import { COL, Member, Network, WEN_FUNC, WenError } from '@buildcore/interfaces';
import { Bip32Path, Ed25519 } from '@iota/crypto.js';
import { Bip32Path as Bip32PathNext, Ed25519 as Ed25519Next } from '@iota/crypto.js-next';
import { Bech32Helper, ED25519_ADDRESS_TYPE, Ed25519Address, Ed25519Seed } from '@iota/iota.js';
import {
  Bech32Helper as Bech32HelperNext,
  ED25519_ADDRESS_TYPE as ED25519_ADDRESS_TYPE_NEXT,
  Ed25519Address as Ed25519AddressNext,
  Ed25519Seed as Ed25519SeedNext,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js';
import { Converter as ConverterNext } from '@iota/util.js-next';
import { generateMnemonic } from 'bip39';
import { decodeAuth, getRandomNonce } from '../../src/utils/wallet.utils';
import { expectThrow } from '../controls/common';
import { PROJECT_API_KEY } from '../set-up';

describe('Legacy Pub key test', () => {
  it.each([Network.RMS, Network.SMR])('Should validate SMR pub key', async (network: Network) => {
    const address = getSmrAddress(network);
    const nonce = getRandomNonce();
    const userDocRef = database().doc(COL.MEMBER, address.bech32);
    await userDocRef.create({ uid: address.bech32, nonce });
    const signature = Ed25519Next.sign(
      address.keyPair.privateKey,
      Converter.utf8ToBytes(`0x${toHex(nonce)}`),
    );
    const request = {
      address: 'address',
      signature: ConverterNext.bytesToHex(signature),
      projectApiKey: PROJECT_API_KEY,
      legacyPublicKey: { hex: ConverterNext.bytesToHex(address.keyPair.publicKey), network },
      body: {},
    };
    const result = await decodeAuth(request, WEN_FUNC.approveProposal);
    expect(result.address).toBe(address.bech32);
    const user = <Member>await userDocRef.get();
    expect(user.validatedAddress![network]).toBe(address.bech32);
  });

  it('Should validate IOTA pub key', async () => {
    const address = await getIotaAddress(Network.IOTA);
    const nonce = getRandomNonce();
    const userDocRef = database().doc(COL.MEMBER, address.bech32);
    await userDocRef.create({ uid: address.bech32, nonce });
    const signature = Ed25519.sign(
      address.keyPair.privateKey,
      Converter.utf8ToBytes(`0x${toHex(nonce)}`),
    );
    const request = {
      address: 'address',
      signature: Converter.bytesToHex(signature),
      projectApiKey: PROJECT_API_KEY,
      legacyPublicKey: {
        hex: Converter.bytesToHex(address.keyPair.publicKey),
        network: Network.IOTA,
      },
      body: {},
    };
    const result = await decodeAuth(request, WEN_FUNC.approveProposal);
    expect(result.address).toBe(address.bech32);
    const user = <Member>await userDocRef.get();
    expect(user.validatedAddress![Network.IOTA]).toBe(address.bech32);
  });

  it.each([Network.RMS, Network.SMR])('Should throw wrong pub key', async (network: Network) => {
    const address = getSmrAddress(network);
    const nonce = getRandomNonce();
    const userDocRef = database().doc(COL.MEMBER, address.bech32);
    await userDocRef.create({ uid: address.bech32, nonce });
    const signature = Ed25519Next.sign(
      address.keyPair.privateKey,
      Converter.utf8ToBytes(`0x${toHex(nonce)}`),
    );
    const secondAddress = getSmrAddress(network);
    const request = {
      address: 'address',
      signature: ConverterNext.bytesToHex(signature),
      projectApiKey: PROJECT_API_KEY,
      legacyPublicKey: { hex: ConverterNext.bytesToHex(secondAddress.keyPair.publicKey), network },
      body: {},
    };
    await expectThrow(
      decodeAuth(request, WEN_FUNC.approveProposal),
      WenError.failed_to_decode_token.key,
    );
  });

  it('Should update nonce when public key sign in', async () => {
    const address = getSmrAddress(Network.RMS);
    const nonce = getRandomNonce();
    const userDocRef = database().doc(COL.MEMBER, address.bech32);
    await userDocRef.create({ uid: address.bech32, nonce });
    const signature = Ed25519Next.sign(
      address.keyPair.privateKey,
      Converter.utf8ToBytes(`0x${toHex(nonce)}`),
    );
    const request = {
      address: 'address',
      signature: ConverterNext.bytesToHex(signature),
      projectApiKey: PROJECT_API_KEY,
      legacyPublicKey: {
        hex: ConverterNext.bytesToHex(address.keyPair.publicKey),
        network: Network.RMS,
      },
      body: {},
    };
    const result = await decodeAuth(request, WEN_FUNC.approveProposal);
    expect(result.address).toBe(address.bech32);
    const user = <Member>await userDocRef.get();
    expect(user.validatedAddress![Network.RMS]).toBe(address.bech32);
    expect(user.nonce).not.toBe(nonce);
  });
});

const toHex = (stringToConvert: string) =>
  stringToConvert
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');

const getSmrAddress = (network: Network) => {
  const mnemonic = generateMnemonic() + ' ' + generateMnemonic();
  const walletSeed = Ed25519SeedNext.fromMnemonic(mnemonic);
  const walletPath = new Bip32PathNext("m/44'/4218'/0'/0'/0'");
  const walletAddressSeed = walletSeed.generateSeedFromPath(walletPath);
  const keyPair = walletAddressSeed.keyPair();
  const walletEd25519Address = new Ed25519AddressNext(keyPair.publicKey);
  const walletAddress = walletEd25519Address.toAddress();
  const hex = ConverterNext.bytesToHex(walletAddress, true);
  const bech32 = Bech32HelperNext.toBech32(ED25519_ADDRESS_TYPE_NEXT, walletAddress, network);
  return { mnemonic, keyPair, hex, bech32 };
};

const getIotaAddress = async (network: Network) => {
  const mnemonic = generateMnemonic() + ' ' + generateMnemonic();
  const genesisSeed = Ed25519Seed.fromMnemonic(mnemonic);
  const genesisPath = new Bip32Path("m/44'/4218'/0'/0'/0'");
  const genesisWalletSeed = genesisSeed.generateSeedFromPath(genesisPath);
  const keyPair = genesisWalletSeed.keyPair();
  const genesisEd25519Address = new Ed25519Address(keyPair.publicKey);
  const genesisWalletAddress = genesisEd25519Address.toAddress();
  const hex = Converter.bytesToHex(genesisWalletAddress);
  const bech32 = Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, genesisWalletAddress, network);
  return { mnemonic, bech32, keyPair, hex };
};
