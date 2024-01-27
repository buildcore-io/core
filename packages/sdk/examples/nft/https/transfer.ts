import { Dataset, Network } from '@build-5/interfaces';
import { Build5, SoonaverseApiKey, https } from '@build-5/sdk';
import { address } from '../../utils/secret';
import { walletSign } from '../../utils/utils';

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
    const response = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.NFT)
      .transfer({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          transfers: [
            { nft: 'build5nftid', target: 'build5memberid' },
            { nft: 'build5nftid', target: 'tangleaddress' },
          ],
        },
      });

    console.log(response);
  } catch (e) {
    console.log(e);
    return;
  }
}

main().then(() => process.exit());
