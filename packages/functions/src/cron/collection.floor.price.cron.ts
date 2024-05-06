import { database } from '@buildcore/database';
import { COL } from '@buildcore/interfaces';

export const updateFloorPriceOnCollections = () =>
  database().collection(COL.COLLECTION).updateFloorPrice();
