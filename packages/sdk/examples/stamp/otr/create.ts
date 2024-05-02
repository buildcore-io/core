import { Dataset } from '@buildcore/interfaces';
import { Buildcore, SoonaverseOtrAddress, otr } from '@buildcore/sdk';

async function main() {
  const origin = Buildcore.TEST;
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
