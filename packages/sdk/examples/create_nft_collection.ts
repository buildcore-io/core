import { Dataset, Network } from '@build-5/interfaces';
import { API_KEY, Build5, https } from '@build-5/sdk';
import { address } from './utils/secret';
import { walletSign } from './utils/utils';

async function main() {
  const network = Network.RMS;
  let userSign = await walletSign(address.bech32, address);
  try {
    const projectAPIKey = API_KEY[Build5.TEST];

    console.log('Create NFT Collection under your project...');
    const collectionName = Math.random()
      .toString(36)
      .substring(2, 5)
      .replace(/[0-9]/g, '')
      .toUpperCase();
    const availableFrom = Date.now();
    const collection = await https(Build5.TEST)
      .project(projectAPIKey)
      .dataset(Dataset.COLLECTION)
      .create(<any>{
        address: address.bech32,
        signature: userSign.signature,
        publicKey: {
          hex: userSign.publicKey,
          network: network,
        },
        body: {
          name: collectionName + ' collection',
          description: collectionName + ' collection description',
          availableFrom: availableFrom,
          access: 0,
          category: 'COLLECTIBLE',
          bannerUrl:
            'https://images-wen.soonaverse.com/0x551fd2c7c7bf356bac194587dab2fcd46420054b/rrvhjuksm4/fe1105c6-2a66-4496-96d1-ed1625293014.jpeg',
          placeholderUrl:
            'https://images-wen.soonaverse.com/0x551fd2c7c7bf356bac194587dab2fcd46420054b/rrvhjuksm4/fe1105c6-2a66-4496-96d1-ed1625293014.jpeg',
          price: 10000000,
          royaltiesFee: 0,
          royaltiesSpace: '0xdb8902015d244df5d6985b45db089b725713709e',
          type: 0,
        },
      });
    console.log('Collection: ' + collection.uid, collection);

    // Create 25 NFTs
    console.log('Create 25 NFTs under your collection...');
    const nftLists = [];
    for (let i = 0; i < 25; i++) {
      const nftName = Math.random()
        .toString(36)
        .substring(2, 5)
        .replace(/[0-9]/g, '')
        .toUpperCase();
      nftLists.push({
        availableFrom: availableFrom,
        collection: collection.uid,
        description: nftName + ' description',
        media:
          'https://images-wen.soonaverse.com/0x551fd2c7c7bf356bac194587dab2fcd46420054b/rrvhjuksm4/fe1105c6-2a66-4496-96d1-ed1625293014.jpeg',
        name: nftName,
        price: 20000000,
      });
    }
    userSign = await walletSign(address.bech32, address);
    const nfts = await https(Build5.TEST)
      .project(projectAPIKey)
      .dataset(Dataset.NFT)
      .createBatch({
        address: address.bech32,
        signature: userSign.signature,
        publicKey: {
          hex: userSign.publicKey,
          network: network,
        },
        body: <any>nftLists,
      });
    console.log('NFT ', nfts);
  } catch (e) {
    console.log(e);
    return;
  }
}

main().then(() => process.exit());
