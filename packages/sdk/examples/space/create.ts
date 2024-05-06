import { Dataset, Network, Space } from '@buildcore/interfaces';
import { Buildcore, SoonaverseApiKey, https } from '@buildcore/sdk';
import { address } from '../utils/secret';
import { walletSign } from '../utils/utils';

async function main() {
  const origin = Buildcore.TEST;
  let response: Space;
  const userSign = await walletSign(address.bech32, address);
  try {
    response = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.SPACE)
      .create({
        address: address.bech32,
        signature: userSign.signature,
        publicKey: {
          hex: userSign.publicKey,
          network: Network.RMS,
        },
        // Use SOONAVERSE TEST - wen.soonaverse.com
        projectApiKey: SoonaverseApiKey[origin],
        body: {
          name: 'TanKRURK',
        },
      });

    console.log(response);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
