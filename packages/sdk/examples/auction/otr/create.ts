import { Dataset, Network } from '@build-5/interfaces';
import { Build5, Build5OtrAddress, SoonaverseApiKey, https, otr } from '@build-5/sdk';

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

    // Once the request is sent the auction will be created and the funds will be credited back
    // The response output's metadata will contain an auction filed with the auction uid.
    // We can use this id to bid on the auction
    const auctionUid = 'auction id retrieved from tangle';
    const otrBidRequest = otr(otrAddress).dataset(Dataset.AUCTION).bid({
      auction: auctionUid,
    });
    // Use this deepling to send funds and bid on the auction
    console.log(otrBidRequest.getFireflyDeepLink());

    // Once auction is no longer active we can fetch it to see the winning bid and bidder
    const auction = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.AUCTION)
      .id(auctionUid)
      .get();
    console.log('Highest bid ', auction.auctionHighestBid);
    console.log('Highest bidder ', auction.auctionHighestBidder);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
