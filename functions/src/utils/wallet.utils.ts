import { randomBytes } from 'crypto';
import { Wallet } from 'ethers';
import Web3 from 'web3';
import Web3Token from 'web3-token';
import { WenError } from "../../interfaces/errors";
import { DecodedToken } from './../../interfaces/functions/index';
import { throwUnAuthenticated } from "./error.utils";

export const ethAddressLength = 42;

export async function decodeToken(token: string): Promise<DecodedToken> {
  if (!token) {
    throw throwUnAuthenticated(WenError.token_must_be_provided);
  }

  try {
    const params: DecodedToken = await Web3Token.verify(token);
    // Validate address.
    if (!Web3.utils.isAddress(params?.address)) {
      throw throwUnAuthenticated(WenError.invalid_wallet_address);
    }

    params.address = params.address.toLowerCase();
    return params;
  } catch(e) {
    console.error(e);
    throw throwUnAuthenticated(WenError.failed_to_decode_token);
  }
};

export function cleanParams(params: any): any {
  delete params['web3-token-version'];
  delete params['expire-date'];
  return params;
}

export function getRandomEthAddress(): string {
  const id: string = randomBytes(32).toString('hex');
  const privateKey: string = '0x' + id;
  // We don't save private key.
  // console.log("SAVE BUT DO NOT SHARE THIS:", privateKey);

  const wallet:Wallet = new Wallet(privateKey);

  // Return public address.
  return wallet.address.toLowerCase();
}
