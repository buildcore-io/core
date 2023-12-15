import { Dataset, Network } from '@build-5/interfaces';
import * as build5 from '../../src';
import { getSignature } from '../common';
import { Build5Local, Build5LocalApi, Build5LocalApiKey, Build5LocalKey, address } from '../config';

describe('', () => {
  it('Create and update member name', async () => {
    let response = await build5.https(Build5Local).createMember({
      address: address.bech32,
      signature: '',
      body: { address: address.bech32 },
    });

    const uid = response.uid;

    const member = await build5
      .https(Build5LocalApi)
      .project(Build5LocalApiKey)
      .dataset(Dataset.MEMBER)
      .id(uid)
      .get();
    expect(member?.uid).toBe(uid);

    const name = Math.random().toString().split('.')[1];
    const signature = await getSignature(uid, address);
    response = await build5
      .https(Build5Local)
      .project(Build5LocalKey)
      .dataset(Dataset.MEMBER)
      .update({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          name,
        },
      });
    expect(response.name).toBe(name);
  });
});
