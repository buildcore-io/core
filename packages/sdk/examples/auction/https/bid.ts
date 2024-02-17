import { Dataset, Network } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';
import { address } from '../../utils/secret';
import { walletSign } from '../../utils/utils';

async function main() {
  const origin = Build5.TEST;
  const userSign = await walletSign(address.bech32, address);

  try {
    const transction = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.AUCTION)
      .bid({
        address: address.bech32,
        signature: userSign.signature,
        publicKey: {
          hex: userSign.publicKey,
          network: Network.RMS,
        },
        body: { auction: 'auction id' },
      });
    console.log('Target address ', transction.payload.targetAddress);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
