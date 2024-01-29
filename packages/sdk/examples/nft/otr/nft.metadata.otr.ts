import { Dataset } from '@build-5/interfaces';
import { Build5, otr } from '@build-5/sdk';

async function main() {
  try {
    const link = otr(Build5.TEST)
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
