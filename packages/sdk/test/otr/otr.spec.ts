import { Dataset } from '@buildcore/interfaces';
import * as buildcore from '../../src';
import { Buildcore, SoonaverseApiKey } from '../../src/https';
import { SoonaverseOtrAddress } from '../../src/otr';

describe('', () => {
  it('Deep link test', async () => {
    const otrAddress = SoonaverseOtrAddress.TEST;
    const request = buildcore.otr(otrAddress).dataset(Dataset.MEMBER).validateAddress();

    const deeplink = request.getFireflyDeepLink();

    console.log(deeplink);

    const tag = request.getTag(deeplink);
    console.log(tag);

    const obs = buildcore
      .https(Buildcore.TEST)
      .project(SoonaverseApiKey[Buildcore.TEST])
      .trackByTag(tag);
    const subs = obs.subscribe((n) => console.log(n));

    await new Promise((resolve) => setTimeout(resolve, 200000));

    subs.unsubscribe();
  });
});
