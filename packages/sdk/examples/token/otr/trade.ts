import { Dataset } from '@build-5/interfaces';
import { otr, SoonaverseOtrAddress } from '@build-5/sdk';

async function main() {
  // @ts-ignore
  const otrAddress = SoonaverseOtrAddress[origin];

  try {
    const otrRequestBuy = await otr(otrAddress).dataset(Dataset.TOKEN).buyToken({
      count: 10,
      symbol: 'IOTA',
      price: 0.002,
    });

    var fireflyDeeplink = otrRequestBuy.getFireflyDeepLink();
    console.log(fireflyDeeplink);

    const otrRequestSellBase = await otr(otrAddress).dataset(Dataset.TOKEN).sellBaseToken({
      count: 10,
      symbol: 'SMR',
      price: 0.002,
    });

    fireflyDeeplink = otrRequestSellBase.getFireflyDeepLink();
    console.log(fireflyDeeplink);

    const otrRequestSell = await otr(otrAddress).dataset(Dataset.TOKEN).sellMintedToken('tokenId', {
      count: 10,
      symbol: 'IOTA',
      price: 0.002,
    });

    fireflyDeeplink = otrRequestSell.getFireflyDeepLink();
    console.log(fireflyDeeplink);
  } catch (e) {
    console.log(e);
    return;
  }
}

main().then(() => process.exit());
