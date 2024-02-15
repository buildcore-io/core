import { Dataset, Network, Subset } from '@build-5/interfaces';
import * as build5 from '../../src';
import {
  Build5Local,
  Build5LocalApi,
  Build5LocalApiKey,
  Build5LocalKey,
  address,
  address_secondary,
} from '../config';
import { wait, walletSign } from './utils';

describe('Space', () => {
  let space: string;

  beforeEach(async () => {
    await build5.https(Build5Local).createMember({
      address: address.bech32,
      signature: '',
      body: { address: address.bech32 },
    });

    const signature = await walletSign(address.bech32, address);
    let spaceResponse = await build5
      .https(Build5Local)
      .project(Build5LocalKey)
      .dataset(Dataset.SPACE)
      .create({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        projectApiKey: Build5LocalApiKey,
        body: {
          name: 'My test space',
          open: true,
        },
      });
    space = spaceResponse.uid;
  });

  it('Should get member and guardian', async () => {
    await build5.https(Build5Local).createMember({
      address: address_secondary.bech32,
      signature: '',
      body: { address: address_secondary.bech32 },
    });

    const signature = await walletSign(address_secondary.bech32, address_secondary);
    await build5
      .https(Build5Local)
      .project(Build5LocalKey)
      .dataset(Dataset.SPACE)
      .join({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        projectApiKey: Build5LocalApiKey,
        body: {
          uid: space,
        },
      });

    const base = build5
      .https(Build5LocalApi)
      .project(Build5LocalApiKey)
      .dataset(Dataset.SPACE)
      .id(space);

    let isMember: boolean | undefined = undefined;
    const isMemberObs = base.subset(Subset.MEMBERS).subsetId(address_secondary.bech32).getLive();
    const isMemberSubs = isMemberObs.subscribe((m) => {
      isMember = m !== undefined;
    });

    await wait(async () => {
      return isMember === true;
    });

    isMemberSubs.unsubscribe();

    let isGuardian: boolean | undefined = undefined;
    const isGuardianObs = base
      .subset(Subset.GUARDIANS)
      .subsetId(address_secondary.bech32)
      .getLive();
    const isGuardianSubs = isGuardianObs.subscribe((m) => {
      isGuardian = m !== undefined;
    });

    await wait(async () => {
      return isGuardian === false;
    });

    isGuardianSubs.unsubscribe();
  });
});
