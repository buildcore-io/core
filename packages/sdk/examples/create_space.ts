import { Dataset, Network, Space } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';
import { address } from './utils/secret';
import { walletSign } from './utils/utils';

async function main() {
  const origin = Build5.TEST;
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
  } catch (e) {
    console.log(e);
    return;
  }

  console.log(response);
}

main().then(() => process.exit());
