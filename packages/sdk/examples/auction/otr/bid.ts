import { Dataset } from '@build-5/interfaces';
import { Build5, SoonaverseOtrAddress, otr } from '@build-5/sdk';

async function main() {
  const origin = Build5.TEST;
  // @ts-ignore
  const otrAddress = SoonaverseOtrAddress[origin];

  try {
    const auctionUid = 'auction id';
    const otrBidRequest = otr(otrAddress).dataset(Dataset.AUCTION).bid({
      auction: auctionUid,
    });
    // Use this deepling to send funds and bid on the auction
    console.log(otrBidRequest.getFireflyDeepLink());
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
