import { Dataset } from '@build-5/interfaces';
import { otr, SoonaverseOtrAddress } from '@build-5/sdk';

async function main() {
  // @ts-ignore
  const otrAddress = SoonaverseOtrAddress[origin];

  try {
    const otrRequest = await otr(otrAddress).dataset(Dataset.TOKEN).claimAirdrops({
        symbol: 'IOTA',
    });

    var fireflyDeeplink = otrRequest.getFireflyDeepLink();
    console.log(fireflyDeeplink);
  } catch (e) {
    console.log(e);
    return;
  }
}

main().then(() => process.exit());
