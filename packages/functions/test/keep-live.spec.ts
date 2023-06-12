import { COL } from '@build-5/interfaces';
import EventSource from 'eventsource';
import { isEmpty } from 'lodash';
import { soonDb } from '../src/firebase/firestore/soondb';
import { getRandomEthAddress } from '../src/utils/wallet.utils';
import { wait } from './controls/common';

const baseUrl = 'http://127.0.0.1:5001/soonaverse-dev/us-central1/api';
describe('Keep alive test', () => {
  it('Should send back data', async () => {
    const col = COL.MEMBER;
    const uid = getRandomEthAddress();
    const sessionId = getRandomEthAddress();
    const eventSourceUrl = `${baseUrl}/getById?collection=${col}&uid=${uid}&sessionId=${sessionId}`;

    const source = new EventSource(eventSourceUrl);

    let data: any = {};
    const docRef = soonDb().doc(`${col}/${uid}`);
    await docRef.create({ uid, asd: false });
    source.addEventListener('update', (event) => {
      data = JSON.parse(event.data);
    });

    await wait(async () => {
      return !isEmpty(data);
    });
    let expected = await docRef.get<any>();
    expect(data).toEqual(expected);

    data = {};
    await docRef.update({ uid, asd: true });
    await wait(async () => {
      return !isEmpty(data);
    });
    expected = await docRef.get<any>();
    expect(data).toEqual(expected);

    source.close();
  });

  it('Should get many live', async () => {
    const sessionId = getRandomEthAddress();
    const col = COL.NFT;
    const uids = [getRandomEthAddress(), getRandomEthAddress()];
    const field = getRandomEthAddress();

    const eventSourceUrl = `${baseUrl}/getMany?collection=${col}&sessionId=${sessionId}&fieldName=field&fieldValue=${field}`;
    const source = new EventSource(eventSourceUrl);

    let data: any[] = [];

    source.addEventListener('update', (event) => {
      data = JSON.parse(event.data);
    });

    let nfts: any = uids.map((uid, index) => ({ hidden: false, uid, index, field }));

    for (const nft of nfts) {
      await soonDb().doc(`${col}/${nft.uid}`).create(nft);
    }

    nfts = await soonDb().collection(col).where('field', '==', field).get<any>();

    await wait(async () => {
      return data.length === 2;
    });

    const expected = JSON.parse(JSON.stringify(nfts.map((n: any) => ({ id: n.uid, ...n }))));
    expect(data).toEqual(expected);

    data = [];
    for (const nft of nfts) {
      await soonDb().doc(`${col}/${nft.uid}`).update({ index: -1 });
    }

    source.close();
  });
});
