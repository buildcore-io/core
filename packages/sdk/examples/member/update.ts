import { Dataset, Network } from '@buildcore/interfaces';
import { Buildcore, SoonaverseApiKey, https } from '@buildcore/sdk';
import { address } from '../utils/secret';
import { walletSign } from '../utils/utils';

async function main() {
  const origin = Buildcore.TEST;
  try {
    const member = await https(origin)
      .project(SoonaverseApiKey[Buildcore.TEST])
      .dataset(Dataset.MEMBER)
      .id(address.bech32)
      .get();

    const name = Math.random().toString().split('.')[1];
    const signature = await walletSign(member.uid, address);
    const response = await https(origin)
      .project(SoonaverseApiKey[Buildcore.TEST])
      .dataset(Dataset.MEMBER)
      .update({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          name: name + '_fun',
        },
      });

    console.log('Member updated: ', response);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
