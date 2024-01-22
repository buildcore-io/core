import { Dataset, Network } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';
import { address } from '../utils/secret';
import { walletSign } from '../utils/utils';

async function main() {
  try {
    const origin = Build5.TEST;

    // Get the first space of our member and let's hope we are a guardian there as this is needed to update the space
    const member = await https(origin)
      .project(SoonaverseApiKey[Build5.TEST])
      .dataset(Dataset.MEMBER)
      .id(address.bech32)
      .get();
    const space = Object.values(member.spaces)[0];

    const signature = await walletSign(member.uid, address);
    const response = await https(origin)
      .project(SoonaverseApiKey[Build5.TEST])
      .dataset(Dataset.SPACE)
      .validateAddress({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          network: 'rms',
          space: space.uid,
        },
      });

    console.log('Address validation request send: ', response);
    console.log(`Please send ${response.payload.amount} to ${response.payload.targetAddress}.`);
  } catch (error) {
    console.log(error);
  }
}

main().then(() => process.exit());
