import { Dataset, Network } from '@buildcore/interfaces';
import { Buildcore, SoonaverseApiKey, https } from '@buildcore/sdk';
import { address } from '../../utils/secret';
import { walletSign } from '../../utils/utils';

async function main() {
  let userSign = await walletSign(address.bech32, address);
  try {
    const projectAPIKey = SoonaverseApiKey[Buildcore.TEST];

    console.log('Create NFT Collection under your project...');
    const collectionName = Math.random()
      .toString(36)
      .substring(2, 5)
      .replace(/[0-9]/g, '')
      .toUpperCase();
    const dateNow = Date.now();
    const collection = await https(Buildcore.TEST)
      .project(projectAPIKey)
      .dataset(Dataset.COLLECTION)
      .create(<any>{
        address: address.bech32,
        signature: userSign.signature,
        publicKey: {
          hex: userSign.publicKey,
          network: Network.RMS,
        },
        body: {
          name: collectionName + ' collection',
          description: collectionName + ' collection description',
          availableFrom: dateNow,
          access: 0,
          category: 'COLLECTIBLE',
          bannerUrl:
            'https://images-wen.soonaverse.com/0x551fd2c7c7bf356bac194587dab2fcd46420054b/rrvhjuksm4/fe1105c6-2a66-4496-96d1-ed1625293014.jpeg',
          placeholderUrl:
            'https://images-wen.soonaverse.com/0x551fd2c7c7bf356bac194587dab2fcd46420054b/rrvhjuksm4/fe1105c6-2a66-4496-96d1-ed1625293014.jpeg',
          price: 10000000,
          royaltiesFee: 0,
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
        availableFrom: dateNow,
        collection: collection.uid,
        description: nftName + ' description',
        media:
          'https://images-wen.soonaverse.com/0x551fd2c7c7bf356bac194587dab2fcd46420054b/rrvhjuksm4/fe1105c6-2a66-4496-96d1-ed1625293014.jpeg',
        name: nftName,
        price: 20000000,
      });
    }
    userSign = await walletSign(address.bech32, address);
    const nfts = await https(Buildcore.TEST)
      .project(projectAPIKey)
      .dataset(Dataset.NFT)
      .createBatch({
        address: address.bech32,
        signature: userSign.signature,
        publicKey: {
          hex: userSign.publicKey,
          network: Network.RMS,
        },
        body: <any>nftLists,
      });
    console.log('NFT ', nfts);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
