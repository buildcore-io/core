import { Dataset, Network } from '@buildcore/interfaces';
import { Buildcore, SoonaverseApiKey, https } from '@buildcore/sdk';
import { address } from '../utils/secret';
import { walletSign } from '../utils/utils';

async function main() {
  try {
    const origin = Buildcore.TEST;
    const member = await https(origin)
      .project(SoonaverseApiKey[Buildcore.TEST])
      .dataset(Dataset.MEMBER)
      .id(address.bech32)
      .get();

    const signature = await walletSign(member.uid, address);
    const response = await https(origin)
      .project(SoonaverseApiKey[Buildcore.TEST])
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

    console.log('Address validation request send: ', response);
    console.log(`Please send ${response.payload.amount} to ${response.payload.targetAddress}.`);
  } catch (error) {
    console.log(error);
  }
}

main().then(() => process.exit());
