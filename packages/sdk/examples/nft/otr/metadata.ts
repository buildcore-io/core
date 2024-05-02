import { Dataset } from '@buildcore/interfaces';
import { SoonaverseOtrAddress, otr } from '@buildcore/sdk';

async function main() {
  try {
    const link = otr(SoonaverseOtrAddress.TEST)
      .dataset(Dataset.NFT)
      .mintMetadataNft({
        metadata: { prop1: 'prop1', prop2: 'prop2' },
      });
    console.log(link);
  } catch (e) {
    console.log(e);
    return;
  }
}

main().then(() => process.exit());
