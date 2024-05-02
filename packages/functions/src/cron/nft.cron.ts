import { database } from '@buildcore/database';
import { COL } from '@buildcore/interfaces';
import dayjs from 'dayjs';

export const hidePlaceholderAfterSoldOutCron = async () => {
  const snap = await database()
    .collection(COL.NFT)
    .where('sold', '==', true)
    .where('placeholderNft', '==', true)
    .where('availableFrom', '==', null)
    .where('hidden', '==', false)
    .where('owner', '==', null)
    .get();
  for (const nft of snap) {
    if (
      nft.soldOn &&
      nft.soldOn.toDate() &&
      dayjs(nft.soldOn.toDate()).isBefore(dayjs().add(24, 'hours'))
    ) {
      await database().collection(COL.NFT).doc(nft.uid).update({
        hidden: true,
      });
    }
  }

  return null;
};
