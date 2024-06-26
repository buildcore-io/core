import { Dataset, Network, Transaction } from '@buildcore/interfaces';
import { Buildcore, SoonaverseApiKey, https } from '@buildcore/sdk';
import { address } from '../../utils/secret';
import { walletSign } from '../../utils/utils';

async function main() {
  const origin = Buildcore.TEST;
  let response: Transaction;
  const userSign = await walletSign(address.bech32, address);

  console.log('Create swap. Set network, recipient and asks.');
  console.log('Asks can be base token, native tokens and nfts');
  try {
    response = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.SWAP)
      .create({
        address: address.bech32,
        signature: userSign.signature,
        publicKey: {
          hex: userSign.publicKey,
          network: Network.RMS,
        },
        body: {
          network: Network.RMS,
          recipient: 'recipient UID or address',
          nfts: ['nftUid1', 'nftUid2'],
        },
      });

    const targetAddress = response.payload.targetAddress;
    console.log('Send bids to swap order address', targetAddress);
    console.log('Once bids are sent mark the swap as funded.');

    await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.SWAP)
      .setFunded({
        address: address.bech32,
        signature: userSign.signature,
        publicKey: {
          hex: userSign.publicKey,
          network: Network.RMS,
        },
        body: { uid: response.payload.swap },
      });

    console.log('Once asks are sent as well the swap will be fulfilled.');
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
