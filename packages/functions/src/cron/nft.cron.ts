import { build5Db } from '@build-5/database';
import { COL, Nft } from '@build-5/interfaces';
import dayjs from 'dayjs';

export const hidePlaceholderAfterSoldOutCron = async () => {
  const snap = await build5Db()
    .collection(COL.NFT)
    .where('sold', '==', true)
    .where('placeholderNft', '==', true)
    .where('availableFrom', '==', null)
    .where('hidden', '==', false)
    .where('owner', '==', null)
    .get<Nft>();
  for (const nft of snap) {
    if (
      nft.soldOn &&
      nft.soldOn.toDate() &&
      dayjs(nft.soldOn.toDate()).isBefore(dayjs().add(24, 'hours'))
    ) {
      await build5Db().collection(COL.NFT).doc(nft.uid).update({
        hidden: true,
      });
    }
  }

  return null;
};
