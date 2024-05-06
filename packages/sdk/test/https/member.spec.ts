import { Dataset, Network } from '@buildcore/interfaces';
import * as buildcore from '../../src';
import { getSignature } from '../common';
import {
  BuildcoreLocal,
  BuildcoreLocalApi,
  BuildcoreLocalApiKey,
  BuildcoreLocalKey,
  address,
} from '../config';

describe('', () => {
  it('Create and update member name', async () => {
    let response = await buildcore.https(BuildcoreLocal).createMember({
      address: address.bech32,
      signature: '',
      body: { address: address.bech32 },
    });

    const uid = response.uid;

    const member = await buildcore
      .https(BuildcoreLocalApi)
      .project(BuildcoreLocalApiKey)
      .dataset(Dataset.MEMBER)
      .id(uid)
      .get();
    expect(member?.uid).toBe(uid);

    const name = Math.random().toString().split('.')[1];
    const signature = await getSignature(uid, address);
    response = await buildcore
      .https(BuildcoreLocal)
      .project(BuildcoreLocalKey)
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
