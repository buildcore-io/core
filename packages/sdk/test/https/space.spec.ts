import { Dataset, Network, Subset } from '@buildcore/interfaces';
import * as buildcore from '../../src';
import {
  BuildcoreLocal,
  BuildcoreLocalApi,
  BuildcoreLocalApiKey,
  BuildcoreLocalKey,
  address,
  address_secondary,
} from '../config';
import { wait, walletSign } from './utils';

describe('Space', () => {
  let space: string;

  beforeEach(async () => {
    await buildcore.https(BuildcoreLocal).createMember({
      address: address.bech32,
      signature: '',
      body: { address: address.bech32 },
    });

    const signature = await walletSign(address.bech32, address);
    let spaceResponse = await buildcore
      .https(BuildcoreLocal)
      .project(BuildcoreLocalKey)
      .dataset(Dataset.SPACE)
      .create({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        projectApiKey: BuildcoreLocalApiKey,
        body: {
          name: 'My test space',
          open: true,
        },
      });
    space = spaceResponse.uid;
  });

  it('Should get member and guardian', async () => {
    await buildcore.https(BuildcoreLocal).createMember({
      address: address_secondary.bech32,
      signature: '',
      body: { address: address_secondary.bech32 },
    });

    const signature = await walletSign(address_secondary.bech32, address_secondary);
    await buildcore
      .https(BuildcoreLocal)
      .project(BuildcoreLocalKey)
      .dataset(Dataset.SPACE)
      .join({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        projectApiKey: BuildcoreLocalApiKey,
        body: {
          uid: space,
        },
      });

    const base = buildcore
      .https(BuildcoreLocalApi)
      .project(BuildcoreLocalApiKey)
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
