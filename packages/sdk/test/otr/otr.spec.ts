import { Dataset } from '@build-5/interfaces';
import * as build5 from '../../src';
import { Build5ApiKey, Build5 } from '../../src/https';
import { Build5OtrAddress } from '../../src/otr';

describe('', () => {
  it('Deep link test', async () => {
    const otrAddress = Build5OtrAddress.TEST;
    const request = build5.otr(otrAddress).dataset(Dataset.MEMBER).validateAddress();

    const deeplink = request.getFireflyDeepLink();

    console.log(deeplink);

    const tag = request.getTag(deeplink);
    console.log(tag);

    const obs = build5.https(Build5.TEST).project(Build5ApiKey[Build5.TEST]).trackByTag(tag);
    const subs = obs.subscribe((n) => console.log(n));

    await new Promise((resolve) => setTimeout(resolve, 200000));

    subs.unsubscribe();
  });
});
