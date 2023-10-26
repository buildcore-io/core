import { ITransaction, build5Db } from '@build-5/database';
import {
  COL,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  NetworkAddress,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { head, isEmpty } from 'lodash';
import { getProject } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { MemberAddressService } from './address/address-member.service';
import { SpaceAddressService } from './address/address.space.service';
import { AuctionBidService } from './auction/auction-bid.service';
import { AwardFundService } from './award/award-service';
import { HandlerParams } from './base';
import { CreditService } from './credit-service';
import { MetadataNftService } from './metadataNft-service';
import { CollectionMintingService } from './nft/collection-minting.service';
import { NftDepositService } from './nft/nft-deposit.service';
import { NftPurchaseService } from './nft/nft-purchase.service';
import { NftStakeService } from './nft/nft-stake.service';
import { SpaceClaimService } from './space/space-service';
import { StakeService } from './stake-service';
import { StampService } from './stamp.service';
import { TangleRequestService } from './tangle-service/TangleRequestService';
import { ImportMintedTokenService } from './token/import-minted-token.service';
import { TokenAirdropClaimService } from './token/token-airdrop-claim.service';
import { TokenMintService } from './token/token-mint.service';
import { TokenMintedAirdropService } from './token/token-minted-airdrop.service';
import { MintedTokenClaimService } from './token/token-minted-claim.service';
import { TokenPurchaseService } from './token/token-purchase.service';
import { TokenTradeService } from './token/token-trade.service';
import { TransactionService } from './transaction-service';
import { VotingService } from './voting-service';

export class ProcessingService {
  private tranService: TransactionService;

  constructor(private readonly transaction: ITransaction) {
    this.tranService = new TransactionService(this.transaction);
  }

  public markAsVoid = (nftService: NftPurchaseService, transaction: Transaction) =>
    nftService.markAsVoid(transaction);

  public submit = () => this.tranService.submit();

  public processMilestoneTransactions = async (tran: MilestoneTransaction): Promise<void> => {
    const build5Transaction = await this.getBuild5Transaction(tran);

    for (const tranOutput of tran.outputs) {
      if (
        build5Transaction?.type !== TransactionType.UNLOCK &&
        tran.fromAddresses.includes(tranOutput.address)
      ) {
        continue;
      }

      const order = await this.findOrderForAddress(tranOutput.address);
      if (order) {
        await this.processOrderTransaction(tran, tranOutput, order.uid, build5Transaction);
      }
    }
  };

  private async processOrderTransaction(
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    orderId: string,
    build5Tran: Transaction | undefined,
  ): Promise<void> {
    const orderRef = build5Db().doc(`${COL.TRANSACTION}/${orderId}`);
    const order = await this.tranService.transaction.get<Transaction>(orderRef);

    if (!order) {
      return;
    }

    const expireDate = dayjs(order.payload.expiresOn?.toDate());
    let expired = false;
    if (expireDate.isBefore(dayjs(), 'ms')) {
      const nftService = new NftPurchaseService(this.tranService);
      await this.markAsVoid(nftService, order);
      expired = true;
    }

    const match = await this.tranService.isMatch(tran, tranEntry, order, build5Tran);
    if (!expired && !order.payload.reconciled && !order.payload.void && match) {
      const expirationUnlock = this.tranService.getExpirationUnlock(tranEntry.unlockConditions);
      if (expirationUnlock !== undefined) {
        const type = tranEntry.nftOutput
          ? TransactionPayloadType.UNLOCK_NFT
          : TransactionPayloadType.UNLOCK_FUNDS;
        await this.tranService.createUnlockTransaction(
          order,
          tran,
          tranEntry,
          type,
          tranEntry.outputId,
          dateToTimestamp(dayjs.unix(expirationUnlock.unixTime)),
        );
        return;
      }

      const serviceParams: HandlerParams = {
        payment: undefined,
        match,
        order,
        project: getProject(order),
        owner: order.member || '',
        tran,
        tranEntry,
        build5Tran,
        request: {},
      };
      const service = this.getService(this.tranService, order.payload.type!);
      await service.handleRequest(serviceParams);
    } else {
      await this.tranService.processAsInvalid(tran, order, tranEntry, build5Tran);
    }

    // Add linked transaction.
    this.tranService.push({
      ref: orderRef,
      data: {
        linkedTransactions: [
          ...(order.linkedTransactions || []),
          ...this.tranService.linkedTransactions,
        ],
      },
      action: 'update',
    });
  }

  private getService = (tranService: TransactionService, type: TransactionPayloadType) => {
    switch (type) {
      case TransactionPayloadType.NFT_PURCHASE:
        return new NftPurchaseService(tranService);
      case TransactionPayloadType.NFT_BID:
      case TransactionPayloadType.AUCTION_BID:
        return new AuctionBidService(tranService);
      case TransactionPayloadType.SPACE_ADDRESS_VALIDATION:
        return new SpaceAddressService(tranService);
      case TransactionPayloadType.MEMBER_ADDRESS_VALIDATION:
        return new MemberAddressService(tranService);
      case TransactionPayloadType.TOKEN_PURCHASE:
        return new TokenPurchaseService(tranService);
      case TransactionPayloadType.TOKEN_AIRDROP:
        return new TokenAirdropClaimService(tranService);
      case TransactionPayloadType.AIRDROP_MINTED_TOKEN:
        return new TokenMintedAirdropService(tranService);
      case TransactionPayloadType.MINT_TOKEN:
        return new TokenMintService(tranService);
      case TransactionPayloadType.CLAIM_MINTED_TOKEN:
        return new MintedTokenClaimService(tranService);
      case TransactionPayloadType.SELL_TOKEN:
      case TransactionPayloadType.BUY_TOKEN:
        return new TokenTradeService(tranService);
      case TransactionPayloadType.MINT_COLLECTION:
        return new CollectionMintingService(tranService);
      case TransactionPayloadType.DEPOSIT_NFT:
        return new NftDepositService(tranService);
      case TransactionPayloadType.CREDIT_LOCKED_FUNDS:
        return new CreditService(tranService);
      case TransactionPayloadType.STAKE:
        return new StakeService(tranService);
      case TransactionPayloadType.TANGLE_REQUEST:
        return new TangleRequestService(tranService);
      case TransactionPayloadType.PROPOSAL_VOTE:
        return new VotingService(tranService);
      case TransactionPayloadType.CLAIM_SPACE:
        return new SpaceClaimService(tranService);
      case TransactionPayloadType.STAKE_NFT:
        return new NftStakeService(tranService);
      case TransactionPayloadType.FUND_AWARD:
        return new AwardFundService(tranService);
      case TransactionPayloadType.IMPORT_TOKEN:
        return new ImportMintedTokenService(tranService);
      case TransactionPayloadType.MINT_METADATA_NFT:
        return new MetadataNftService(tranService);
      case TransactionPayloadType.STAMP:
        return new StampService(tranService);
      default:
        throw invalidArgument(WenError.invalid_tangle_request_type);
    }
  };

  private findOrderForAddress = async (address: NetworkAddress) => {
    const snap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.ORDER)
      .where('payload.targetAddress', '==', address)
      .limit(1)
      .get<Transaction>();
    return head(snap);
  };

  private getBuild5Transaction = (tran: MilestoneTransaction) => {
    if (isEmpty(tran.build5TransactionId)) {
      return;
    }
    const docRef = build5Db().doc(`${COL.TRANSACTION}/${tran.build5TransactionId}`);
    return docRef.get<Transaction>();
  };
}
