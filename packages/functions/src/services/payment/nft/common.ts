import { build5Db } from '@build-5/database';
import { COL, Collection, Member, Nft, NftAccess, Transaction } from '@build-5/interfaces';
import { getAddress } from '../../../utils/address.utils';
import { getProject } from '../../../utils/common.utils';
import { serverTime } from '../../../utils/dateTime.utils';
import { createNftWithdrawOrder } from '../tangle-service/nft/nft-purchase.service';
import { TransactionService } from '../transaction-service';

export class BaseNftService {
  constructor(private readonly transactionService: TransactionService) {}

  public setTradingStats = (nft: Nft) => {
    const data = { lastTradedOn: serverTime(), totalTrades: build5Db().inc(1) };
    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nft.collection}`);
    this.transactionService.push({ ref: collectionDocRef, data, action: 'update' });

    const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    this.transactionService.push({ ref: nftDocRef, data, action: 'update' });
  };

  public withdrawNft = async (order: Transaction, nft: Nft) => {
    const membderDocRef = build5Db().doc(`${COL.MEMBER}/${order.member}`);
    const member = <Member>await membderDocRef.get();
    const { order: withdrawOrder, nftUpdateData } = createNftWithdrawOrder(
      getProject(order),
      nft,
      member.uid,
      getAddress(member, order.network!),
    );
    this.transactionService.push({
      ref: build5Db().doc(`${COL.TRANSACTION}/${withdrawOrder.uid}`),
      data: withdrawOrder,
      action: 'set',
    });
    this.transactionService.push({
      ref: build5Db().doc(`${COL.NFT}/${nft.uid}`),
      data: nftUpdateData,
      action: 'update',
    });
  };

  public setNftOwner = async (order: Transaction, amount: number) => {
    const nftDocRef = build5Db().collection(COL.NFT).doc(order.payload.nft!);
    const nft = <Nft>await this.transactionService.get(nftDocRef);

    const nftUpdateData = {
      owner: order.member,
      isOwned: true,
      price: nft.saleAccess === NftAccess.MEMBERS ? nft.price : amount,
      sold: true,
      locked: false,
      lockedBy: null,
      hidden: false,
      soldOn: nft.soldOn || serverTime(),
      availableFrom: null,
      availablePrice: null,
      auctionFrom: null,
      auctionTo: null,
      extendedAuctionTo: null,
      auctionFloorPrice: null,
      auctionLength: null,
      extendedAuctionLength: null,
      auctionHighestBid: null,
      auctionHighestBidder: null,
      saleAccess: null,
      saleAccessMembers: [],
      auction: null,
    };
    this.transactionService.push({
      ref: nftDocRef,
      data: nftUpdateData,
      action: 'update',
    });

    if (order.payload.beneficiary === 'space') {
      const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${order.payload.collection}`);
      this.transactionService.push({
        ref: collectionDocRef,
        data: { sold: build5Db().inc(1) },
        action: 'update',
      });

      const collection = (await this.transactionService.get<Collection>(collectionDocRef))!;
      if (collection.placeholderNft && collection.total === collection.sold + 1) {
        const placeholderNftDocRef = build5Db().doc(`${COL.NFT}/${collection.placeholderNft}`);
        this.transactionService.push({
          ref: placeholderNftDocRef,
          data: {
            sold: true,
            owner: null,
            availablePrice: null,
            availableFrom: null,
            soldOn: serverTime(),
            hidden: false,
          },
          action: 'update',
        });
      }
    }
  };
}
