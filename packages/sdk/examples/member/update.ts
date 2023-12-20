import { Dataset, Network } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';
import { address } from '../utils/secret';
import { walletSign } from '../utils/utils';

async function main() {
  const origin = Build5.TEST;
  const member = await https(origin)
    .project(SoonaverseApiKey[Build5.TEST])
    .dataset(Dataset.MEMBER)
    .id(address.bech32)
    .get();

  const name = Math.random().toString().split('.')[1];
  const signature = await walletSign(member.uid, address);
  const response = await https(origin)
    .project(SoonaverseApiKey[Build5.TEST])
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
}

main().then(() => process.exit());
