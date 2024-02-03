import { Dataset, Network } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';
import { address } from '../../utils/secret';
import { walletSign } from '../../utils/utils';

async function main() {
  const origin = Build5.TEST;

  try {
    const member = await https(origin)
      .project(SoonaverseApiKey[Build5.TEST])
      .dataset(Dataset.MEMBER)
      .id(address.bech32)
      .get();

    const signature = await walletSign(member.uid, address);
    const response = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.TOKEN)
      .create({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          name: 'Test Token',
          symbol: 'TT',
          space: '0x37dfcbf867decc598986c48a418ef5c001f59577',
          totalSupply: 1000000,
          decimals: 18,
          allocations: [
            {
              title: 'Allocation 1',
              percentage: 15,
            },
            {
              title: 'Allocation 2',
              percentage: 25,
            },
            {
              title: 'Allocation 3',
              percentage: 60,
            },
          ],
        },
      });

    console.log(response);
  } catch (e) {
    console.log(e);
    return;
  }
}

main().then(() => process.exit());
