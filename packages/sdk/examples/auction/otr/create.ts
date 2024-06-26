import { Dataset, Network } from '@buildcore/interfaces';
import { Buildcore, SoonaverseOtrAddress, otr } from '@buildcore/sdk';

async function main() {
  const origin = Buildcore.TEST;
  // @ts-ignore
  const otrAddress = SoonaverseOtrAddress[origin];

  try {
    // To create a generic auction we send an otr request with the needed params
    const otrCreateRequest = otr(otrAddress).dataset(Dataset.AUCTION).create({
      auctionFloorPrice: 1000000,
      auctionFrom: new Date(),
      auctionLength: 8.64e7, // 1 day in milliseconds
      maxBids: 1,
      minimalBidIncrement: 1000000,
      network: Network.RMS,
      space: 'spaceid',
    });

    const fireflyDeeplink = otrCreateRequest.getFireflyDeepLink();
    console.log(fireflyDeeplink);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
