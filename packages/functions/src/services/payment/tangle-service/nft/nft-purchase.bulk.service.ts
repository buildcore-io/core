import { database } from '@buildcore/database';
import {
  COL,
  Collection,
  CollectionType,
  Member,
  Network,
  TRANSACTION_AUTO_EXPIRY_MS,
  TangleResponse,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { Dictionary, flatten, get, groupBy, isEmpty, uniq } from 'lodash';
import { getNftByMintingId } from '../../../../utils/collection-minting-utils/nft.utils';
import { getProject } from '../../../../utils/common.utils';
import { isProdEnv } from '../../../../utils/config.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertIpNotBlocked } from '../../../../utils/ip.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getSpace } from '../../../../utils/space.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { nftPurchaseBulkSchema } from './NftPurchaseBulkTangleRequestSchema';
import {
  assertCurrentOwnerAddress,
  assertNftCanBePurchased,
  getCollection,
  getDiscount,
  getMember,
  getNftAbove,
  getNftBelow,
  getNftFinalPrice,
} from './nft-purchase.service';

export interface NftBulkOrder {
  collection: string;
  nft?: string;
}

export class TangleNftPurchaseBulkService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    order: tangleOrder,
    request,
    owner,
    tran,
    tranEntry,
    payment,
  }: HandlerParams) => {
    const params = await assertValidationAsync(nftPurchaseBulkSchema, request);

    const order = await createNftBulkOrder(getProject(tangleOrder), params.orders!, owner);
    order.payload.tanglePuchase = true;
    order.payload.disableWithdraw = params.disableWithdraw || false;

    this.transactionService.push({
      ref: database().doc(COL.TRANSACTION, order.uid),
      data: order,
      action: Action.C,
    });

    if (tranEntry.amount !== order.payload.amount || tangleOrder.network !== order.network) {
      return {
        status: 'error',
        amount: order.payload.amount!,
        address: order.payload.targetAddress!,
        code: WenError.invalid_base_token_amount.code,
        message: WenError.invalid_base_token_amount.key,
      };
    }

    this.transactionService.createUnlockTransaction(
      payment,
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );

    return {};
  };
}

export const createNftBulkOrder = async (
  project: string,
  orders: NftBulkOrder[],
  owner: string,
  ip = '',
): Promise<Transaction> => {
  const member = await getMember(owner);

  const grouped = groupBy(orders, 'collection');
  const awaitedPrices = await getNftPrices(grouped, member, ip);

  const networks = uniq(flatten(awaitedPrices.map((p) => p.networks)));
  if (networks.length > 1) {
    throw invalidArgument(WenError.nfts_must_be_within_same_network);
  }

  const prices = flatten(awaitedPrices.map((p) => p.prices));
  const finalPrice = prices.reduce((acc, act) => acc + act.price, 0);
  if (!finalPrice) {
    throw invalidArgument(WenError.no_more_nft_available_for_sale);
  }

  const wallet = await WalletService.newWallet(networks[0]);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  return {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: '',
    network: networks[0],
    payload: {
      type: TransactionPayloadType.NFT_PURCHASE_BULK,
      amount: finalPrice,
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
      nftOrders: prices,
    },
    linkedTransactions: [],
  };
};

const getNftPrices = async (
  CollectionNftGroup: Dictionary<NftBulkOrder[]>,
  member: Member,
  ip: string,
) => {
  const defaultNetwork = isProdEnv() ? Network.IOTA : Network.ATOI;
  const pricesPromises = Object.entries(CollectionNftGroup).map(
    async ([collectionId, nftOrders]) => {
      const nftIds = nftOrders.map((o) => o.nft!);
      const { collection, nfts } = await getNfts(collectionId, nftIds);
      const space = (await getSpace(collection.space))!;

      const discount = getDiscount(collection, member);

      const pricePromises = nfts.map(async (nft) => {
        const nftIdParam = nftIds.find((id) => id === nft.uid) || '';
        try {
          if (isProdEnv()) {
            await assertIpNotBlocked(ip, nft.uid, 'nft');
          }

          await assertNftCanBePurchased(space, collection, nft, nftIdParam, member.uid, true);

          const currentOwner = nft.owner ? await getMember(nft.owner) : space;
          assertCurrentOwnerAddress(currentOwner, nft);

          const finalPrice = getNftFinalPrice(nft, discount);

          return {
            collection: collectionId,
            nft: nft.uid,
            requestedNft: nftIdParam,
            price: finalPrice,
            error: 0,
          };
        } catch (error) {
          return {
            collection: collectionId,
            nft: nft.uid,
            requestedNft: nftIdParam,
            price: 0,
            error: get(error, 'eCode', 0),
          };
        }
      });
      const networks = nfts.map((nft) => nft.mintingData?.network || defaultNetwork);
      return { prices: await Promise.all(pricePromises), networks };
    },
  );
  return await Promise.all(pricesPromises);
};

const getNfts = async (collectionId: string, nftIds: (string | undefined)[]) => {
  const collection = await getCollection(collectionId);
  const nftPromises = nftIds.filter((id) => !isEmpty(id)).map((nftId) => getNft(nftId!));
  const randomNfts = await getRandomNft(collection, nftIds.filter((id) => isEmpty(id)).length);
  const nfts = (await Promise.all(nftPromises)).concat(randomNfts);
  return { collection, nfts };
};

const getNft = async (nftId: string) => {
  const docRef = database().doc(COL.NFT, nftId);
  const nft = (await getNftByMintingId(nftId)) || (await docRef.get());
  if (nft) {
    return nft;
  }
  throw invalidArgument(WenError.nft_does_not_exists);
};

const getRandomNft = async (collection: Collection, count: number) => {
  if (!count) {
    return [];
  }
  if (collection.type === CollectionType.CLASSIC) {
    throw invalidArgument(WenError.nft_does_not_exists);
  }

  const randomPosition = Math.floor(Math.random() * collection.total);

  const nftAbove = await getNftAbove(collection, randomPosition, count);
  if (nftAbove.length >= count) {
    return nftAbove.slice(0, count);
  }

  const nftBelow = await getNftBelow(collection, randomPosition, count - nftAbove.length);
  return nftAbove.concat(nftBelow.slice(0, count - nftAbove.length));
};
