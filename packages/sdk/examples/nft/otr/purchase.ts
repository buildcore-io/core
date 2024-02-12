import { Dataset } from '@build-5/interfaces';
import { Build5, Build5OtrAddress, https, otr, SoonaverseApiKey } from '@build-5/sdk';

const collectionId = 'build5collectionid1';
const nftId = 'build5nftid1';

const origin = Build5.TEST;
// @ts-ignore
const otrAddress = Build5OtrAddress[origin];

async function main() {
  const otrRequest = otr(otrAddress)
    .dataset(Dataset.NFT)
    .purchase({ collection: collectionId, nft: nftId });

  const fireflyDeeplink = otrRequest.getFireflyDeepLink();
  console.log('Firefly Deeplink: ', fireflyDeeplink);

  console.log('\n');
  console.log(
    'Sending correct will cause NFT purchase and goes back to buyers wallet. Invalid amount will be refunded.',
  );

  const tag = otrRequest.getTag(fireflyDeeplink);
  const obs = https(Build5.TEST).project(SoonaverseApiKey[Build5.TEST]).trackByTag(tag);
  console.log('Listen to payment progress:');
  obs.subscribe((n) => console.log('- update: ', n));
}

main().then(() => process.exit());
