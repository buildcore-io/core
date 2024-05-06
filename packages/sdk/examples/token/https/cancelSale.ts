import { Dataset, Network } from '@buildcore/interfaces';
import { Buildcore, SoonaverseApiKey, https } from '@buildcore/sdk';
import { address } from '../../utils/secret';
import { walletSign } from '../../utils/utils';

async function main() {
  const origin = Buildcore.TEST;

  try {
    const member = await https(origin)
      .project(SoonaverseApiKey[Buildcore.TEST])
      .dataset(Dataset.MEMBER)
      .id(address.bech32)
      .get();

    const signature = await walletSign(member.uid, address);
    const response = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.TOKEN)
      .cancelPublicSale({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          token: 'tokenId',
        },
      });

    console.log(response);
  } catch (e) {
    console.log(e);
    return;
  }
}

main().then(() => process.exit());
