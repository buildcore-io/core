import { Dataset, Network } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';
import { address } from '../utils/secret';
import { walletSign } from '../utils/utils';

async function main() {
  try {
    const origin = Build5.TEST;
    const member = await https(origin)
      .project(SoonaverseApiKey[Build5.TEST])
      .dataset(Dataset.MEMBER)
      .id(address.bech32)
      .get();

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
        },
      });

    console.log('Address validated: ', response);
  } catch (error) {
    console.log(error);
  }
}

main().then(() => process.exit());
