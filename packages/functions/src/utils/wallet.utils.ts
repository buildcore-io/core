import { Ed25519 } from '@iota/crypto.js';
import { Ed25519 as Ed25519Next } from '@iota/crypto.js-next';
import { Bech32Helper, Ed25519Address } from '@iota/iota.js';
import {
  Bech32Helper as Bech32HelperNext,
  Ed25519Address as Ed25519AddressNext,
  ED25519_ADDRESS_TYPE,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js';
import { Converter as ConverterNext, HexHelper } from '@iota/util.js-next';
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import {
  COL,
  DecodedToken,
  Member,
  Network,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import { randomBytes } from 'crypto';
import dayjs from 'dayjs';
import { Wallet } from 'ethers';
import jwt from 'jsonwebtoken';
import { get } from 'lodash';
import admin from '../admin.config';
import { getCustomTokenLifetime, getJwtSecretKey } from './config.utils';
import { uOn } from './dateTime.utils';
import { throwUnAuthenticated } from './error.utils';

export const minAddressLength = 42;
export const maxAddressLength = 255;

const toHex = (stringToConvert: string) =>
  stringToConvert
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');

export async function decodeAuth(req: WenRequest, func: WEN_FUNC): Promise<DecodedToken> {
  if (!req) {
    throw throwUnAuthenticated(WenError.invalid_params);
  }

  if (!req.address) {
    throw throwUnAuthenticated(WenError.address_must_be_provided);
  }

  if (req.signature && req.publicKey) {
    const validateFunc = getValidateFuncForNetwork(req.publicKey!.network);
    const address = await validateFunc(req);
    const userDocRef = admin.firestore().doc(`${COL.MEMBER}/${address}`);
    const user = <Member | undefined>(await userDocRef.get()).data();
    if (!user) {
      throw throwUnAuthenticated(WenError.failed_to_decode_token);
    }
    return { address, body: req.body };
  }

  if (req.signature) {
    const userDocRef = admin.firestore().doc(`${COL.MEMBER}/${req.address}`);
    const user = <Member | undefined>(await userDocRef.get()).data();
    if (!user) {
      throw throwUnAuthenticated(WenError.failed_to_decode_token);
    }
    await validateWithSignature(req, user);
    return { address: req.address, body: req.body };
  }

  if (req.customToken) {
    await validateWithIdToken(req, func);
    return { address: req.address, body: req.body };
  }

  throw throwUnAuthenticated(WenError.signature_or_custom_token_must_be_provided);
}

const validateWithSignature = async (req: WenRequest, user: Member) => {
  if (!user.nonce) {
    throw throwUnAuthenticated(WenError.missing_nonce);
  }

  const recoveredAddress = recoverPersonalSignature({
    data: `0x${toHex(user.nonce)}`,
    signature: req.signature!,
  });

  if (recoveredAddress !== req.address) {
    throw throwUnAuthenticated(WenError.invalid_signature);
  }

  await admin
    .firestore()
    .doc(`${COL.MEMBER}/${req.address}`)
    .update(uOn({ nonce: getRandomNonce() }));
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
  throw throwUnAuthenticated(WenError.invalid_network);
};

const validateSmrPubKey = async (req: WenRequest) => {
  const signedData = ConverterNext.hexToBytes(HexHelper.stripPrefix(req.signature!));
  const publicKey = ConverterNext.hexToBytes(HexHelper.stripPrefix(req.publicKey?.hex!));

  const ed25519Address = new Ed25519AddressNext(publicKey);
  const publicKeyAddress = ed25519Address.toAddress();
  const bech32Address = Bech32HelperNext.toBech32(
    ED25519_ADDRESS_TYPE,
    publicKeyAddress,
    req.publicKey!.network,
  );
  const messageData = ConverterNext.utf8ToBytes(bech32Address);

  const verify = Ed25519Next.verify(publicKey, messageData, signedData);
  if (!verify) {
    throw throwUnAuthenticated(WenError.invalid_signature);
  }
  return bech32Address;
};

const validateIotaPubKey = async (req: WenRequest) => {
  const stripPrefix = (data: string) => data.replace(/^0x/i, '');

  const signedData = Converter.hexToBytes(stripPrefix(req.signature!));
  const publicKey = Converter.hexToBytes(stripPrefix(req.publicKey?.hex!));

  const ed25519Address = new Ed25519Address(publicKey);
  const publicKeyAddress = ed25519Address.toAddress();
  const bech32Address = Bech32Helper.toBech32(
    ED25519_ADDRESS_TYPE,
    publicKeyAddress,
    req.publicKey!.network,
  );
  const messageData = Converter.utf8ToBytes(bech32Address);

  const verify = Ed25519.verify(publicKey, messageData, signedData);
  if (!verify) {
    throw throwUnAuthenticated(WenError.invalid_signature);
  }
  return bech32Address;
};

const validateWithIdToken = async (req: WenRequest, func: WEN_FUNC) => {
  const decoded = jwt.verify(req.customToken!, getJwtSecretKey());

  if (get(decoded, 'uid', '') !== req.address) {
    throw throwUnAuthenticated(WenError.invalid_custom_token);
  }

  const exp = dayjs.unix(get(decoded, 'exp', 0));
  if (exp.isBefore(dayjs())) {
    throw throwUnAuthenticated(WenError.invalid_custom_token);
  }

  const lifetime = getCustomTokenLifetime(func) || 3600;
  const iat = dayjs.unix(get(decoded, 'iat', 0)).add(lifetime, 's');
  if (iat.isBefore(dayjs())) {
    throw throwUnAuthenticated(WenError.invalid_custom_token);
  }
};

export function getRandomEthAddress() {
  const wallet = new Wallet('0x' + randomBytes(32).toString('hex'));
  return wallet.address.toLowerCase();
}

export const getRandomNonce = () => Math.floor(Math.random() * 1000000).toString();
