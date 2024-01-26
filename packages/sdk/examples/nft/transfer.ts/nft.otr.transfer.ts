import { Dataset } from '@build-5/interfaces';
import { Build5, Build5OtrAddress, otr } from '@build-5/sdk';

const origin = Build5.TEST;
// @ts-ignore
const otrAddress = Build5OtrAddress[origin];

async function main() {
  const fireflyDeepling = otr(otrAddress)
    .dataset(Dataset.NFT)
    .transfer({
      transfers: [
        { nft: 'build5nftid', target: 'build5memberid' },
        { nft: 'build5nftid', target: 'tangleaddress' },
      ],
    })
    .getFireflyDeepLink();

  console.log('Sent amount with ', fireflyDeepling);
}

main().then(() => process.exit());
