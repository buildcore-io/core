import { Dataset, Network } from '@buildcore/interfaces';
import { Buildcore, SoonaverseApiKey, https } from '@buildcore/sdk';
import { address } from '../../utils/secret';
import { walletSign } from '../../utils/utils';

async function main() {
  const origin = Buildcore.TEST;
  const userSign = await walletSign(address.bech32, address);

  try {
    // To create a generic auction we send an https request with the needed params
    let auction = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.AUCTION)
      .create({
        address: address.bech32,
        signature: userSign.signature,
        publicKey: {
          hex: userSign.publicKey,
          network: Network.RMS,
        },
        body: {
          auctionFloorPrice: 1000000,
          auctionFrom: new Date(),
          auctionLength: 8.64e7, // 1 day in milliseconds
          maxBids: 1,
          minimalBidIncrement: 1000000,
          network: Network.RMS,
          space: 'spaceid',
        },
      });
    console.log('Auction created with id: ', auction.uid);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
