import { Dataset } from '@buildcore/interfaces';
import { Buildcore, SoonaverseOtrAddress, otr } from '@buildcore/sdk';

async function main() {
  const origin = Buildcore.TEST;
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
