import {
  COL,
  DecodedToken,
  Member,
  Network,
  WEN_FUNC,
  WenError,
  WenRequest,
} from '@build5/interfaces';
import { Ed25519 } from '@iota/crypto.js';
import { Ed25519 as Ed25519Next } from '@iota/crypto.js-next';
import { Bech32Helper, Ed25519Address } from '@iota/iota.js';
import {
  Bech32Helper as Bech32HelperNext,
  ED25519_ADDRESS_TYPE,
  Ed25519Address as Ed25519AddressNext,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js';
import { Converter as ConverterNext, HexHelper } from '@iota/util.js-next';
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import { randomBytes } from 'crypto';
import dayjs from 'dayjs';
import { Wallet } from 'ethers';
import jwt from 'jsonwebtoken';
import { get } from 'lodash';
import { soonDb } from '../firebase/firestore/soondb';
import { getCustomTokenLifetime, getJwtSecretKey } from './config.utils';
import { unAuthenticated } from './error.utils';

export const minAddressLength = 42;
export const maxAddressLength = 255;

const toHex = (stringToConvert: string) =>
  stringToConvert
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');

export async function decodeAuth(req: WenRequest, func: WEN_FUNC): Promise<DecodedToken> {
  if (!req) {
    throw unAuthenticated(WenError.invalid_params);
  }

  if (req.signature && req.publicKey) {
    const address = await validateWithPublicKey(req);
    return { address, body: req.body };
  }

  if (req.signature) {
    await validateWithSignature(req);
    return { address: req.address, body: req.body };
  }

  if (req.customToken) {
    await validateWithIdToken(req, func);
    return { address: req.address, body: req.body };
  }

  throw unAuthenticated(WenError.signature_or_custom_token_must_be_provided);
}

const validateWithSignature = async (req: WenRequest) => {
  const member = await getMember(req.address);

  const recoveredAddress = recoverPersonalSignature({
    data: `0x${toHex(member.nonce!)}`,
    signature: req.signature!,
  });

  if (recoveredAddress !== req.address) {
    throw unAuthenticated(WenError.invalid_signature);
  }

  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${req.address}`);
  await memberDocRef.update({ nonce: getRandomNonce() });
};

const validateWithPublicKey = async (req: WenRequest) => {
  const network = req.publicKey!.network;

  const validateFunc = getValidateFuncForNetwork(network);
  const { member, address } = await validateFunc(req);
  if (!address) {
    throw unAuthenticated(WenError.failed_to_decode_token);
  }

  const validatedAddress = (member.validatedAddress || {})[network] || address;
  const updateData = {
    nonce: getRandomNonce(),
    validatedAddress: { [network]: validatedAddress },
  };
  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${address}`);
  await memberDocRef.set(updateData, true);

  return address;
};

const getValidateFuncForNetwork = (network: Network) => {
  const smrNnetworks = [Network.SMR, Network.RMS];
  if (smrNnetworks.includes(network)) {
    return validateSmrPubKey;
  }
  const iotaNnetworks = [Network.IOTA, Network.ATOI];
  if (iotaNnetworks.includes(network)) {
    return validateIotaPubKey;
  }
  throw unAuthenticated(WenError.invalid_network);
};

const validateSmrPubKey = async (req: WenRequest) => {
  const signedData = ConverterNext.hexToBytes(HexHelper.stripPrefix(req.signature!));
  const publicKey = ConverterNext.hexToBytes(HexHelper.stripPrefix(req.publicKey?.hex!));

  const bech32Address = Bech32HelperNext.toBech32(
    ED25519_ADDRESS_TYPE,
    new Ed25519AddressNext(publicKey).toAddress(),
    req.publicKey!.network,
  );

  const member = await getMember(bech32Address);
  const unsignedData = ConverterNext.utf8ToBytes(`0x${toHex(member.nonce!)}`);

  const verify = Ed25519Next.verify(publicKey, unsignedData, signedData);
  if (!verify) {
    throw unAuthenticated(WenError.invalid_signature);
  }

  return { member, address: bech32Address };
};

const validateIotaPubKey = async (req: WenRequest) => {
  const signedData = Converter.hexToBytes(HexHelper.stripPrefix(req.signature!));
  const publicKey = Converter.hexToBytes(HexHelper.stripPrefix(req.publicKey?.hex!));

  const bech32Address = Bech32Helper.toBech32(
    ED25519_ADDRESS_TYPE,
    new Ed25519Address(publicKey).toAddress(),
    req.publicKey!.network,
  );

  const member = await getMember(bech32Address);
  const unsignedData = Converter.utf8ToBytes(`0x${toHex(member.nonce!)}`);

  const verify = Ed25519.verify(publicKey, unsignedData, signedData);
  if (!verify) {
    throw unAuthenticated(WenError.invalid_signature);
  }

  return { member, address: bech32Address };
};

const getMember = async (address: string) => {
  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${address}`);
  const member = await memberDocRef.get<Member>();
  if (!member) {
    throw unAuthenticated(WenError.failed_to_decode_token);
  }
  if (!member.nonce) {
    throw unAuthenticated(WenError.missing_nonce);
  }
  return member;
};

const validateWithIdToken = async (req: WenRequest, func: WEN_FUNC) => {
  const decoded = jwt.verify(req.customToken!, getJwtSecretKey());

  if (get(decoded, 'uid', '') !== req.address) {
    throw unAuthenticated(WenError.invalid_custom_token);
  }

  const exp = dayjs.unix(get(decoded, 'exp', 0));
  if (exp.isBefore(dayjs())) {
    throw unAuthenticated(WenError.invalid_custom_token);
  }

  const lifetime = getCustomTokenLifetime(func) || 3600;
  const iat = dayjs.unix(get(decoded, 'iat', 0)).add(lifetime, 's');
  if (iat.isBefore(dayjs())) {
    throw unAuthenticated(WenError.invalid_custom_token);
  }
};

export function getRandomEthAddress() {
  const wallet = new Wallet('0x' + randomBytes(32).toString('hex'));
  return wallet.address.toLowerCase();
}

export const getRandomNonce = () => Math.floor(Math.random() * 1000000).toString();
