import { COL, Network, Nft, NftStatus } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { get } from 'lodash';
import { fixMintedNftIds } from '../../../scripts/dbUpgrades/0.18/nftId.roll';
import admin from '../../../src/admin.config';
describe('Nft id roll', () => {
  it('Should roll nft id', async () => {
    const nfts = [
      {
        uid: '0x0a9912cd521b02dbf117a16c97c80f06f47ef90e',
        mintingData: {
          blockId: '0xbac07a49ccf2064b5e7623231a0f71d73ab206178cfaf5d539be77a79fd72d01',
          nftId: '0x31cb6eb8022fe4f318bedd8c69f93b04df4d993a4ae4d3b52e2db899ebcf5f26',
          network: Network.RMS,
          mintedOn: dayjs('2022-09-02').toDate(),
        },
        status: NftStatus.WITHDRAWN,
      },
      {
        uid: '0x153277ca9a26bdee342a37e1e8cdce04d6afe327',
        mintingData: {
          blockId: '0xbac07a49ccf2064b5e7623231a0f71d73ab206178cfaf5d539be77a79fd72d01',
          nftId: 'wrong',
          network: Network.RMS,
          mintedOn: dayjs('2022-09-02').toDate(),
        },
        status: NftStatus.WITHDRAWN,
      },
      {
        uid: '1234',
        mintingData: {
          blockId: '0xbac07a49ccf2064b5e7623231a0f71d73ab206178cfaf5d539be77a79fd72d01',
          nftId: 'ok',
          network: Network.RMS,
          mintedOn: dayjs('2023-02-02').toDate(),
        },
        status: NftStatus.WITHDRAWN,
      },
    ];
    for (const nft of nfts) {
      const docRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
      await docRef.set(nft);
    }

    await fixMintedNftIds(admin.app());

    let docRef = admin.firestore().doc(`${COL.NFT}/${nfts[0].uid}`);
    let nft = <Nft>(await docRef.get()).data();
    expect(nft.mintingData?.nftId).toBe(
      '0x31cb6eb8022fe4f318bedd8c69f93b04df4d993a4ae4d3b52e2db899ebcf5f26',
    );
    expect(get(nft, 'mintingData.nftIdFixed')).toBe(true);

    docRef = admin.firestore().doc(`${COL.NFT}/${nfts[1].uid}`);
    nft = <Nft>(await docRef.get()).data();
    expect(nft.mintingData?.nftId).toBe(
      '0xb3e773a7080c66aa5e884119cf741ad323c7725f958e3fd198b56216198efd01',
    );
    expect(get(nft, 'mintingData.nftIdFixed')).toBe(true);

    docRef = admin.firestore().doc(`${COL.NFT}/${nfts[2].uid}`);
    nft = <Nft>(await docRef.get()).data();
    expect(nft.mintingData?.nftId).toBe('ok');
  });
});
