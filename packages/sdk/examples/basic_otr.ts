import { Dataset } from '@build-5/interfaces';
import { Build5OtrAddress, otr } from '@build-5/sdk';

async function main() {
    const otrRequest = otr(Build5OtrAddress.TEST)
        .dataset(Dataset.NFT)
        .mintMetadataNft({
            metadata: { prop1: 'prop1', prop2: 'prop2' },
        });
    console.log(otrRequest.getFireflyDeepLink());
}
main().then(() => process.exit());
