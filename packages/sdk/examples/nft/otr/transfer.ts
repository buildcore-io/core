import { Dataset } from '@buildcore/interfaces';
import { Buildcore, SoonaverseOtrAddress, otr } from '@buildcore/sdk';

const origin = Buildcore.TEST;
// @ts-ignore
const otrAddress = SoonaverseOtrAddress[origin];

async function main() {
  const otrRequest = otr(otrAddress)
    .dataset(Dataset.NFT)
    .transfer({
      transfers: [
        { nft: 'nftid', target: 'memberid' },
        { nft: 'nftid', target: 'tangleaddress' },
      ],
    });
  const fireflyDeeplink = otrRequest.getFireflyDeepLink();

  console.log('Sent amount with ', fireflyDeeplink);
}

main().then(() => process.exit());
