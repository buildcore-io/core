import { Dataset } from '@build-5/interfaces';
import * as build5 from '../../src';
import { Build5, SoonaverseApiKey } from '../../src/https';
import { SoonaverseOtrAddress } from '../../src/otr';

describe('', () => {
  it('Deep link test', async () => {
    const otrAddress = SoonaverseOtrAddress.TEST;
    const request = build5.otr(otrAddress).dataset(Dataset.MEMBER).validateAddress();

    const deeplink = request.getFireflyDeepLink();

    console.log(deeplink);

    const tag = request.getTag(deeplink);
    console.log(tag);

    const obs = build5.https(Build5.TEST).project(SoonaverseApiKey[Build5.TEST]).trackByTag(tag);
    const subs = obs.subscribe((n) => console.log(n));

    await new Promise((resolve) => setTimeout(resolve, 200000));

    subs.unsubscribe();
  });
});
