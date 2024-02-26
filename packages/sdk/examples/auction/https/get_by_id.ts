import { Dataset } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, SoonaverseOtrAddress, https } from '@build-5/sdk';

async function main() {
  const origin = Build5.TEST;
  // @ts-ignore
  const otrAddress = SoonaverseOtrAddress[origin];

  try {
    const auctionUid = 'auction id retrieved from tangle';
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
