import { Dataset, Network } from '@buildcore/interfaces';
import { Buildcore, SoonaverseApiKey, https } from '@buildcore/sdk';
import { address } from '../utils/secret';
import { walletSign } from '../utils/utils';

async function main() {
  const origin = Buildcore.TEST;
  try {
    // Get the first space of our member and let's hope we are a guardian there as this is needed to update the space
    const member = await https(origin)
      .project(SoonaverseApiKey[Buildcore.TEST])
      .dataset(Dataset.MEMBER)
      .id(address.bech32)
      .get();
    const space = Object.values(member.spaces)[0];

    const name = Math.random().toString().split('.')[1];
    const signature = await walletSign(address.bech32, address);
    const response = await https(origin)
      .project(SoonaverseApiKey[Buildcore.TEST])
      .dataset(Dataset.SPACE)
      .update({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          uid: space.uid,
          name: name + '_fun',
        },
      });

    console.log('Space updated: ', response);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
