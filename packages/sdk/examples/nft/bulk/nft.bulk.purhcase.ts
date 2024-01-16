import { Dataset, Network } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';
import { address } from '../../utils/secret';
import { walletSign } from '../../utils/utils';

const collectionId = 'build5nftcollectionid';
const nftIds = ['build5nftid1', 'build5nftid2'];

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
      .bulkPurchase({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          orders: nftIds.map((nftId) => ({ collection: collectionId, nft: nftId })),
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
    console.log('Once the order is funded, payload.nftOrders will be update.');
    console.log('If price and nft is set, it means that that NFT was bough.');
    console.log('Otherwise error will contain an error code and amount will be credited.');
  } catch (e) {
    console.log(e);
    return;
  }
}

main().then(() => process.exit());
