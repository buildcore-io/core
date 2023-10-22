import { build5Db } from '@build-5/database';
import {
  COL,
  DecodedToken,
  Member,
  NetworkAddress,
  SOON_PROJECT_ID,
  WEN_FUNC,
  WenError,
  WenRequest,
} from '@build-5/interfaces';
import { Ed25519Signature, INodeInfo, Utils } from '@iota/sdk';
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import { randomBytes } from 'crypto';
import dayjs from 'dayjs';
import { Wallet } from 'ethers';
import jwt from 'jsonwebtoken';
import { get } from 'lodash';
import { WalletService } from '../services/wallet/wallet.service';
import { getCustomTokenLifetime, getJwtSecretKey } from './config.utils';
import { invalidArgument, unAuthenticated } from './error.utils';

const toHex = (stringToConvert: string) =>
  stringToConvert
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');

export const decodeAuth = async (
  req: WenRequest,
  func: WEN_FUNC,
  projectIsRequired: boolean,
): Promise<DecodedToken> => {
  if (!req) {
    throw unAuthenticated(WenError.invalid_params);
  }

  if (projectIsRequired && !req.projectApiKey) {
    throw invalidArgument(WenError.invalid_project_api_key);
  }

  const decoded = req.projectApiKey
    ? jwt.verify(req.projectApiKey, getJwtSecretKey())
    : { project: SOON_PROJECT_ID };
  const project = get(decoded, 'project', '');
  if (!project) {
    throw invalidArgument(WenError.invalid_project_api_key);
  }

  if (req.signature && req.publicKey) {
    const address = await validateWithPublicKey(req);
    return { address, project, body: req.body };
  }

  if (req.signature) {
    await validateWithSignature(req);
    return { address: req.address, project, body: req.body };
  }

  if (req.customToken) {
    await validateWithIdToken(req, func);
    return { address: req.address, project, body: req.body };
  }

  throw unAuthenticated(WenError.signature_or_custom_token_must_be_provided);
};

const validateWithSignature = async (req: WenRequest) => {
  const member = await getMember(req.address);

  const recoveredAddress = recoverPersonalSignature({
    data: `0x${toHex(member.nonce!)}`,
    signature: req.signature!,
  });

  if (recoveredAddress !== req.address) {
    throw unAuthenticated(WenError.invalid_signature);
  }

  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${req.address}`);
  await memberDocRef.update({ nonce: getRandomNonce() });
};

const validateWithPublicKey = async (req: WenRequest) => {
  const network = req.publicKey!.network;

  const wallet = await WalletService.newWallet(network);
  const { member, address } = await validatePubKey(wallet.info, req);
  if (!address) {
    throw unAuthenticated(WenError.failed_to_decode_token);
  }

  const validatedAddress = (member.validatedAddress || {})[network] || address;
  const updateData = {
    nonce: getRandomNonce(),
    validatedAddress: { [network]: validatedAddress },
  };
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${address}`);
  await memberDocRef.set(updateData, true);

  return address;
};

const validatePubKey = async (info: INodeInfo, req: WenRequest) => {
  const bech32Address = Utils.hexPublicKeyToBech32Address(
    req.publicKey?.hex!,
    info.protocol.bech32Hrp,
  );

  const member = await getMember(bech32Address);

  const verify = Utils.verifyEd25519Signature(
    new Ed25519Signature(req.publicKey?.hex!, req.signature!),
    `0x${toHex(member.nonce!)}`,
  );
  if (!verify) {
    throw unAuthenticated(WenError.invalid_signature);
  }

  return { member, address: bech32Address };
};

const getMember = async (address: NetworkAddress) => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${address}`);
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
