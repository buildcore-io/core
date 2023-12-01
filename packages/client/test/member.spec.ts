import { Dataset, Network } from '@build-5/interfaces';
import * as build5 from '../src';
import { API_KEY, Build5 } from '../src/https';
import { getSignature } from './common';
import { address } from './config';

describe('', () => {
  it('Create and update member name', async () => {
    const origin = Build5.LOCAL;
    let response = await build5
      .https(origin)
      .dataset(Dataset.MEMBER)
      .create({
        address: address.bech32,
        signature: '',
        projectApiKey: API_KEY[origin],
        body: {
          address: address.bech32,
        },
      });

    const uid = response.uid;

    const apiOrigin = Build5.API_LOCAL;
    const member = await build5.https(apiOrigin).dataset(Dataset.MEMBER).id(uid).get();
    expect(member?.uid).toBe(uid);

    const name = Math.random().toString().split('.')[1];

    const signature = await getSignature(uid, address);
    response = await build5
      .https(origin)
      .dataset(Dataset.MEMBER)
      .update({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        projectApiKey: API_KEY[origin],
        body: {
          name,
        },
      });
    expect(response.name).toBe(name);
  });
});
