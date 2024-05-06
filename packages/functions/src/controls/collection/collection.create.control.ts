import { database } from '@buildcore/database';
import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  CreateCollectionRequest,
  DEFAULT_NETWORK,
  DiscountLine,
  Nft,
  NftStatus,
  SUB_COL,
  WenError,
} from '@buildcore/interfaces';
import { set } from 'lodash';
import { hasStakedTokens } from '../../services/stake.service';
import { assertSpaceHasValidAddress } from '../../utils/address.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';
import { populateTokenUidOnDiscounts } from './common';

export const createCollectionControl = async ({
  owner,
  params,
  project,
}: Context<CreateCollectionRequest>) => {
  const hasStakedSoons = await hasStakedTokens(project, owner);
  if (!hasStakedSoons) {
    throw invalidArgument(WenError.no_staked_soon);
  }

  const spaceUid = params.space || '';
  if (spaceUid) {
    const spaceDocRef = database().doc(COL.SPACE, spaceUid);
    const space = await spaceDocRef.get();
    if (!space) {
      throw invalidArgument(WenError.space_does_not_exists);
    }
    assertSpaceHasValidAddress(space, DEFAULT_NETWORK);

    const spaceMember = await database().doc(COL.SPACE, spaceUid, SUB_COL.MEMBERS, owner).get();
    if (!spaceMember) {
      throw invalidArgument(WenError.you_are_not_part_of_space);
    }
  }

  if (params.royaltiesSpace) {
    const royaltySpace = await database().doc(COL.SPACE, params.royaltiesSpace).get();
    if (!royaltySpace) {
      throw invalidArgument(WenError.space_does_not_exists);
    }
    assertSpaceHasValidAddress(royaltySpace, DEFAULT_NETWORK);
  }

  const batch = database().batch();

  const discounts = <DiscountLine[]>(params.discounts || []);
  const placeholderNftId = params.type !== CollectionType.CLASSIC ? getRandomEthAddress() : null;
  const collection = {
    ...params,
    space: spaceUid,
    project,
    discounts: await populateTokenUidOnDiscounts(discounts),
    uid: getRandomEthAddress(),
    total: 0,
    sold: 0,
    createdBy: owner,
    approved: false,
    rejected: false,
    ipfsMedia: undefined,
    limitedEdition: !!params.limitedEdition,
    onePerMemberOnly: !!params.onePerMemberOnly,
    placeholderNft: placeholderNftId || '',
    status: CollectionStatus.PRE_MINTED,
  };
  if (collection.availableFrom) {
    set(collection, 'availableFrom', dateToTimestamp(params.availableFrom, true));
  }
  const collectionDocRef = database().doc(COL.COLLECTION, collection.uid);
  batch.create(collectionDocRef, collection as unknown as Collection);

  if (placeholderNftId) {
    const placeholderNft = {
      project,
      uid: placeholderNftId,
      name: params.name,
      description: params.description,
      locked: false,
      media: params.placeholderUrl || null,
      availableFrom: collection.availableFrom,
      price: params.price,
      availablePrice: params.price,
      collection: collection.uid,
      position: 0,
      lockedBy: null,
      ipfsMedia: null,
      approved: false,
      rejected: false,
      sold: true,
      soldOn: serverTime(),
      owner: null,
      space: spaceUid,
      type: params.type,
      hidden: true,
      placeholderNft: true,
      createdBy: owner,
      status: NftStatus.PRE_MINTED,
    };
    const placeholderNftDocRef = database().doc(COL.NFT, placeholderNft.uid);
    batch.create(placeholderNftDocRef, placeholderNft as unknown as Nft);
  }
  await batch.commit();

  return await collectionDocRef.get();
};
