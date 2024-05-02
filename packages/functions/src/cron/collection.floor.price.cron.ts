import { build5Db } from '@build-5/database';
import { COL } from '@build-5/interfaces';

export const updateFloorPriceOnCollections = () =>
  build5Db().collection(COL.COLLECTION).updateFloorPrice();
