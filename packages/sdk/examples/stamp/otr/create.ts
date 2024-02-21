import { Dataset } from '@build-5/interfaces';
import { Build5, SoonaverseOtrAddress, otr } from '@build-5/sdk';

async function main() {
  const origin = Build5.TEST;
  // @ts-ignore
  const otrAddress = SoonaverseOtrAddress[origin];

  console.log('Create stamp under your project...');
  try {
    const otrRequest = otr(otrAddress)
      .dataset(Dataset.STAMP)
      .stamp({ uri: 'https://www.africau.edu/images/default/sample.pdf' });

    const fireflyDeeplink = otrRequest.getFireflyDeepLink();
    console.log(fireflyDeeplink);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
