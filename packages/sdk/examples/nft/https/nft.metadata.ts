import { Dataset, Network } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';
import { address } from '../../utils/secret';
import { wait, walletSign } from '../../utils/utils';

async function main() {
  const origin = Build5.TEST;

  const member = await https(origin).createMember({
    address: address.bech32,
    signature: '',
    body: {
      address: address.bech32,
    },
  });

  try {
    const signature = await walletSign(member.uid, address);
    const order = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.NFT)
      .mintMetadata({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          metadata: { name: 'My nft' },
          network: Network.RMS,
        },
      });

    console.log(
      'Sent: ',
      order.payload.amount,
      ' to ',
      order.payload.targetAddress,
      ', full order object: ',
      order,
    );

    // Once orderder is founded and NFT is minted you can get it via the order traget address
    await wait(async () => {
      const nfts = await https(origin)
        .project(SoonaverseApiKey[origin])
        .dataset(Dataset.NFT)
        .getByField('mintingData.address', order.payload.targetAddress!);
      return nfts.length === 1;
    });
    const nfts = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.NFT)
      .getByField('mintingData.address', order.payload.targetAddress!);

    // To update the NFT create and other request with the NFT id
    const updateOrder = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.NFT)
      .mintMetadata({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          metadata: { name: 'My nft' },
          network: Network.RMS,
          nftId: nfts[0].mintingData!.nftId!,
        },
      });
    console.log(
      'Sent: ',
      updateOrder.payload.amount,
      ' to ',
      updateOrder.payload.targetAddress,
      ', to update the NFT metadata',
    );

    // To mint an other NFT under the same collection use collection id
    const collection = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.COLLECTION)
      .id(nfts[0].collection)
      .get();
    const secondNftOrder = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.NFT)
      .mintMetadata({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          metadata: { name: 'Second nft' },
          network: Network.RMS,
          collectionId: collection.mintingData!.nftId!,
        },
      });
    console.log(
      'Sent: ',
      secondNftOrder.payload.amount,
      ' to ',
      secondNftOrder.payload.targetAddress,
      ', to create another NFT within same collection',
    );
  } catch (e) {
    console.log(e);
    return;
  }
}

main().then(() => process.exit());
