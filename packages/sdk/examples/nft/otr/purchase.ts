import { Dataset } from '@buildcore/interfaces';
import { Buildcore, SoonaverseApiKey, SoonaverseOtrAddress, https, otr } from '@buildcore/sdk';

const collectionId = 'collectionid1';
const nftId = 'nftid1';

const origin = Buildcore.TEST;
// @ts-ignore
const otrAddress = SoonaverseOtrAddress[origin];

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
  const obs = https(Buildcore.TEST).project(SoonaverseApiKey[Buildcore.TEST]).trackByTag(tag);
  console.log('Listen to payment progress:');
  obs.subscribe((n) => console.log('- update: ', n));
}

main().then(() => process.exit());
