import { Dataset } from '@build-5/interfaces';
import { Build5, SoonaverseOtrAddress, otr } from '@build-5/sdk';

const origin = Build5.TEST;
// @ts-ignore
const otrAddress = SoonaverseOtrAddress[origin];

async function main() {
  const otrRequest = otr(otrAddress)
    .dataset(Dataset.NFT)
    .transfer({
      transfers: [
        { nft: 'build5nftid', target: 'build5memberid' },
        { nft: 'build5nftid', target: 'tangleaddress' },
      ],
    });
  const fireflyDeeplink = otrRequest.getFireflyDeepLink();

  console.log('Sent amount with ', fireflyDeeplink);
}

main().then(() => process.exit());
