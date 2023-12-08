import { Dataset } from '@build-5/interfaces';
import * as build5 from '../../src';
import { Build5OtrAddress } from '../../src/otr';

describe('', () => {
  it('Deep link test', async () => {
    const otrAddress = Build5OtrAddress.TEST;
    const request = build5.otr(otrAddress).dataset(Dataset.MEMBER).validateAddress();

    const deeplink = await request.getFireflyDeepLink();

    console.log(deeplink);

    const obs = request.track();
    obs.subscribe((n) => console.log(n));

    await new Promise((resolve) => setTimeout(resolve, 100000));
  });
});
