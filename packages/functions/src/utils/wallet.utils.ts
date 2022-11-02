import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import { COL, DecodedToken, WenError, WenRequest } from '@soonaverse/interfaces';
import { randomBytes } from 'crypto';
import { Wallet } from 'ethers';
import admin from '../admin.config';
import { uOn } from './dateTime.utils';
import { throwUnAuthenticated } from './error.utils';
export const ethAddressLength = 42;

const toHex = (stringToConvert: string) =>
  stringToConvert
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');

export async function decodeAuth(req: WenRequest): Promise<DecodedToken> {
  if (!req) {
    throw throwUnAuthenticated(WenError.invalid_params);
  }

  if (!req.address) {
    throw throwUnAuthenticated(WenError.address_must_be_provided);
  }

  if (!req.signature) {
    throw throwUnAuthenticated(WenError.signature_must_be_provided);
  }

  const userDoc = await admin.firestore().collection(COL.MEMBER).doc(req.address).get();
  if (!userDoc.exists) {
    throw throwUnAuthenticated(WenError.failed_to_decode_token);
  }

  const existingNonce: string = userDoc.data()?.nonce;
  if (!userDoc.data()?.nonce) {
    throw throwUnAuthenticated(WenError.missing_nonce);
  }

  const recoveredAddress = recoverPersonalSignature({
    data: `0x${toHex(existingNonce)}`,
    signature: req.signature,
  });

  if (recoveredAddress !== req.address) {
    throw throwUnAuthenticated(WenError.invalid_signature);
  }

  // Set new nonce.
  await admin
    .firestore()
    .collection(COL.MEMBER)
    .doc(req.address)
    .update(
      uOn({
        nonce: Math.floor(Math.random() * 1000000).toString(),
      }),
    );

  return {
    address: req.address.toLowerCase(),
    body: req.body,
  };
}

// None required.
export const cleanParams = <T>(params: T) => params;

export function getRandomEthAddress() {
  const id = randomBytes(32).toString('hex');
  const privateKey = '0x' + id;
  // We don't save private key.
  // console.log("SAVE BUT DO NOT SHARE THIS:", privateKey);

  const wallet: Wallet = new Wallet(privateKey);

  // Return public address.
  return wallet.address.toLowerCase();
}
