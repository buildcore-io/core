import { Dataset, Network, Transaction } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';
import { address } from './utils/secret';
import { walletSign } from './utils/utils';

async function main() {
  const origin = Build5.TEST;
  let response: Transaction;
  const userSign = await walletSign(address.bech32, address);

  console.log('Create stamp under your project...');
  try {
    response = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.STAMP)
      .stamp({
        address: address.bech32,
        signature: userSign.signature,
        publicKey: {
          hex: userSign.publicKey,
          network: Network.RMS,
        },
        body: {
          file: 'https://www.africau.edu/images/default/sample.pdf',
          network: Network.RMS,
        },
      });

      console.log(
        'Sent: ',
        response.payload.amount,
        ' to ',
        response.payload.targetAddress,
        ', full order object: ',
        response,
      );
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
