import { Dataset } from '@buildcore/interfaces';
import { Buildcore, SoonaverseOtrAddress, otr } from '@buildcore/sdk';

const collectionId = 'nftcollectionid';
const nftIds = ['nftid1', 'nftid2'];

const origin = Buildcore.TEST;
// @ts-ignore
const otrAddress = SoonaverseOtrAddress[origin];

async function main() {
  const otrRequest = otr(otrAddress)
    .dataset(Dataset.NFT)
    .bulkPurchase({ orders: nftIds.map((nftId) => ({ collection: collectionId, nft: nftId })) });

  const fireflyDeeplink = otrRequest.getFireflyDeepLink();

  console.log(fireflyDeeplink);

  console.log('Sending whatever amount:');
  console.log(
    'In case you send a random amount your funds will be credited back' +
      ' The response metadata will contain the exact amount needed and target address',
  );

  console.log('\n');
  console.log('Sending correct amount:');
  console.log(
    'In case you send the exact amount needed, your request will be processed and the NFTs will be purchased',
  );

  console.log('\nIn both cases, if an NFT can not be pruchased the amount will be credited back.');
}

main().then(() => process.exit());
