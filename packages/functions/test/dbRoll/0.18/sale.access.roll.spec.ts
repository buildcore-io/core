import { COL, Nft, NftAccess } from '@soonaverse/interfaces';
import { saleAccessRoll } from '../../../scripts/dbUpgrades/0.18/sale.access.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';
import { projectId, testEnv } from '../../set-up';

describe('Nft sale access roll', () => {
  it('Should roll nft sale access', async () => {
    await testEnv.firestore.clearFirestoreData(projectId);

    const nfts = [
      { uid: getRandomEthAddress(), saleAccess: null },
      { uid: getRandomEthAddress(), saleAccess: NftAccess.MEMBERS },
      { uid: getRandomEthAddress() },
      { uid: getRandomEthAddress(), placeholderNft: true },
    ];
    for (const nft of nfts) {
      const docRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
      await docRef.create(nft);
    }

    await saleAccessRoll(admin.app());

    let docRef = admin.firestore().doc(`${COL.NFT}/${nfts[0].uid}`);
    let nft = <Nft>(await docRef.get()).data();
    expect(nft.saleAccess).toBeNull();

    docRef = admin.firestore().doc(`${COL.NFT}/${nfts[1].uid}`);
    nft = <Nft>(await docRef.get()).data();
    expect(nft.saleAccess).toBe(NftAccess.MEMBERS);

    docRef = admin.firestore().doc(`${COL.NFT}/${nfts[2].uid}`);
    nft = <Nft>(await docRef.get()).data();
    expect(nft.saleAccess).toBe(NftAccess.OPEN);

    docRef = admin.firestore().doc(`${COL.NFT}/${nfts[3].uid}`);
    nft = <Nft>(await docRef.get()).data();
    expect(nft.saleAccess).toBeUndefined();
  });
});
