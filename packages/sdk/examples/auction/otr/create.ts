import { Dataset, Network } from '@build-5/interfaces';
import { Build5, Build5OtrAddress, otr } from '@build-5/sdk';

async function main() {
  const origin = Build5.TEST;
  // @ts-ignore
  const otrAddress = Build5OtrAddress[origin];

  try {
    // To create a generic auction we send an otr request with the needed params
    const otrCreateRequest = otr(otrAddress).dataset(Dataset.AUCTION).create({
      auctionFloorPrice: 1000000,
      auctionFrom: new Date(),
      auctionLength: 8.64e7, // 1 day in milliseconds
      maxBids: 1,
      minimalBidIncrement: 1000000,
      network: Network.RMS,
      space: 'build5spaceid',
    });

    const fireflyDeeplink = otrCreateRequest.getFireflyDeepLink();
    console.log(fireflyDeeplink);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
