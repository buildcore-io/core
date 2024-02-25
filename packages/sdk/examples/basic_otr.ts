import { Dataset } from '@build-5/interfaces';
import { SoonaverseOtrAddress, otr } from '@build-5/sdk';

async function main() {
  const otrRequest = otr(SoonaverseOtrAddress.TEST)
    .dataset(Dataset.NFT)
    .mintMetadataNft({
      metadata: { prop1: 'prop1', prop2: 'prop2' },
    });
  console.log(otrRequest.getFireflyDeepLink());
}
main().then(() => process.exit());
