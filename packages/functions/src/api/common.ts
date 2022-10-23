import { PublicCollections, QUERY_MAX_LENGTH } from '@soon/interfaces';
import admin from '../admin.config';

export const getQueryLimit = (collection: PublicCollections) => {
  switch (collection) {
    case PublicCollections.AVATARS:
    case PublicCollections.BADGES:
      return 1;
    default:
      return QUERY_MAX_LENGTH;
  }
};

export const isNotHiddenNft = (
  collection: PublicCollections,
  data: admin.firestore.DocumentData | undefined,
) => collection !== PublicCollections.NFT || data?.hidden === false;
