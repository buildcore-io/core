import Web3 from 'web3';
import Web3Token from 'web3-token';
import { DecodedToken } from './../../interfaces/functions/index';

export async function decodeToken(token: string): Promise<DecodedToken> {
  if (!token) {
    throw new Error('Token must be provided');
  }

  try {
    const params: DecodedToken = await Web3Token.verify(token);
    // Validate address.
    if (!Web3.utils.isAddress(params?.address)) {
      throw new Error('Invalid address');
    }

    params.address = params.address.toLowerCase();
    return params;
  } catch(e) {
    console.error(e);
    throw new Error('Failed to decode the token');
  }
};

export function cleanParams(params: any): any {
  delete params['web3-token-version'];
  delete params['expire-date'];
  return params;
}
