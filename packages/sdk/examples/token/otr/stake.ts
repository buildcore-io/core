import { Dataset } from '@buildcore/interfaces';
import { otr, SoonaverseOtrAddress } from '@buildcore/sdk';

async function main() {
  // @ts-ignore
  const otrAddress = SoonaverseOtrAddress[origin];

  try {
    const otrRequest = await otr(otrAddress).dataset(Dataset.TOKEN).stake('tokenid', 10, {
      symbol: 'IOTA',
      type: 'static',
      weeks: 10,
    });

    var fireflyDeeplink = otrRequest.getFireflyDeepLink();
    console.log(fireflyDeeplink);
  } catch (e) {
    console.log(e);
    return;
  }
}

main().then(() => process.exit());
