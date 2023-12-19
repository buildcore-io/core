import { build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
  CreateCollectionRequest,
  DEFAULT_NETWORK,
  DiscountLine,
  Member,
  NftStatus,
  Space,
  SUB_COL,
  WenError,
} from '@build-5/interfaces';
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
    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${spaceUid}`);
    const space = await spaceDocRef.get<Space>();
    if (!space) {
      throw invalidArgument(WenError.space_does_not_exists);
    }
    assertSpaceHasValidAddress(space, DEFAULT_NETWORK);

    const spaceMember = await spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner).get<Member>();
    if (!spaceMember) {
      throw invalidArgument(WenError.you_are_not_part_of_space);
    }
  }

  if (params.royaltiesFee) {
    const royaltySpace = await build5Db().doc(`${COL.SPACE}/${params.royaltiesSpace}`).get<Space>();
    if (!royaltySpace) {
      throw invalidArgument(WenError.space_does_not_exists);
    }
    assertSpaceHasValidAddress(royaltySpace, DEFAULT_NETWORK);
  }

  if (params.availableFrom) {
    params.availableFrom = dateToTimestamp(params.availableFrom, true).toDate();
  }

  const batch = build5Db().batch();

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
    ipfsMedia: null,
    limitedEdition: !!params.limitedEdition,
    onePerMemberOnly: !!params.onePerMemberOnly,
    placeholderNft: placeholderNftId || null,
    status: CollectionStatus.PRE_MINTED,
  };
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collection.uid}`);
  batch.create(collectionDocRef, collection);

  if (placeholderNftId) {
    const placeholderNft = {
      project,
      uid: placeholderNftId,
      name: params.name,
      description: params.description,
      locked: false,
      media: params.placeholderUrl || null,
      availableFrom: params.availableFrom || null,
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
    const placeholderNftDocRef = build5Db().doc(`${COL.NFT}/${placeholderNft.uid}`);
    batch.create(placeholderNftDocRef, placeholderNft);
  }
  await batch.commit();

  return await collectionDocRef.get<Collection>();
};
