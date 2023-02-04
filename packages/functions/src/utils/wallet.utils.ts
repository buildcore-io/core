import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import { COL, DecodedToken, Member, WenError, WenRequest, WEN_FUNC } from '@soonaverse/interfaces';
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

  if (!req.signature && !req.customToken) {
    throw throwUnAuthenticated(WenError.signature_or_custom_token_must_be_provided);
  }

  const userDocRef = admin.firestore().doc(`${COL.MEMBER}/${req.address}`);
  const user = <Member | undefined>(await userDocRef.get()).data();
  if (!user) {
    throw throwUnAuthenticated(WenError.failed_to_decode_token);
  }

  if (req.signature) {
    await validateWithSignature(req, user);
  } else {
    await validateWithIdToken(req, func);
  }

  return {
    address: req.address.toLowerCase(),
    body: req.body,
  };
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
