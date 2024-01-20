import { Dataset } from '@build-5/interfaces';
import { Build5, Build5OtrAddress, otr } from '@build-5/sdk';

async function main() {
  const origin = Build5.TEST;
  const otrAddress = Build5OtrAddress[origin];

  console.log('Create stamp under your project...');
  try {
    const otrRequest = await otr(otrAddress)
      .dataset(Dataset.STAMP)
      .stamp({ uri: 'https://www.africau.edu/images/default/sample.pdf' });

    const fireflyDeeplink = otrRequest.getFireflyDeepLink();
    console.log(fireflyDeeplink);
  } catch (error) {
    console.error('Error: ', error);
  }
}

main().then(() => process.exit());
