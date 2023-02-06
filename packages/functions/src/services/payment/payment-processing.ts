import {
  COL,
  Entity,
  IotaAddress,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Nft,
  Transaction,
  TransactionOrder,
  TransactionOrderType,
  TransactionType,
  TransactionUnlockType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import admin from '../../admin.config';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { AddressService } from './address-service';
import { AwardService } from './award/award-service';
import { CreditService } from './credit-service';
import { CollectionMintingService } from './nft/collection-minting-service';
import { NftDepositService } from './nft/nft-deposit-service';
import { NftService } from './nft/nft-service';
import { NftStakeService } from './nft/nft-stake-service';
import { SpaceService } from './space/space-service';
import { StakeService } from './stake-service';
import { TangleRequestService } from './tangle-service/TangleRequestService';
import { MintedTokenClaimService } from './token/minted-token-claim';
import { TokenMintService } from './token/token-mint-service';
import { TokenService } from './token/token-service';
import { TransactionService } from './transaction-service';
import { VotingService } from './voting-service';

export class ProcessingService {
  private transactionService: TransactionService;
  private tokenService: TokenService;
  private tokenMintService: TokenMintService;
  private mintedTokenClaimService: MintedTokenClaimService;
  private nftService: NftService;
  private addressService: AddressService;
  private collectionMintingService: CollectionMintingService;
  private creditService: CreditService;
  private stakeService: StakeService;
  private tangleRequestService: TangleRequestService;
  private votingService: VotingService;

  constructor(transaction: FirebaseFirestore.Transaction) {
    this.transactionService = new TransactionService(transaction);
    this.tokenService = new TokenService(this.transactionService);
    this.tokenMintService = new TokenMintService(this.transactionService);
    this.mintedTokenClaimService = new MintedTokenClaimService(this.transactionService);
    this.nftService = new NftService(this.transactionService);
    this.addressService = new AddressService(this.transactionService);
    this.collectionMintingService = new CollectionMintingService(this.transactionService);
    this.creditService = new CreditService(this.transactionService);
    this.stakeService = new StakeService(this.transactionService);
    this.tangleRequestService = new TangleRequestService(this.transactionService);
    this.votingService = new VotingService(this.transactionService);
  }

  public submit = () => this.transactionService.submit();

  public markAsVoid = (transaction: TransactionOrder) => this.nftService.markAsVoid(transaction);

  public markNftAsFinalized = (nft: Nft) => this.nftService.markNftAsFinalized(nft);

  public async processMilestoneTransactions(tran: MilestoneTransaction): Promise<void> {
    if (!tran.outputs?.length) {
      return;
    }
    const soonTransaction = isEmpty(tran.soonaverseTransactionId)
      ? undefined
      : <Transaction | undefined>(
          (
            await admin.firestore().doc(`${COL.TRANSACTION}/${tran.soonaverseTransactionId}`).get()
          ).data()
        );
    for (const tranOutput of tran.outputs) {
      if (
        soonTransaction?.type !== TransactionType.UNLOCK &&
        tran.inputs.find((i) => tranOutput.address === i.address)
      ) {
        continue;
      }
      const orders = await this.findAllOrdersWithAddress(tranOutput.address);
      for (const order of orders.docs) {
        await this.processOrderTransaction(tran, tranOutput, order.id, soonTransaction);
      }
    }
  }

  private async processOrderTransaction(
    tran: MilestoneTransaction,
    tranOutput: MilestoneTransactionEntry,
    orderId: string,
    soonTransaction: Transaction | undefined,
  ): Promise<void> {
    const orderRef = admin.firestore().collection(COL.TRANSACTION).doc(orderId);
    const order = <TransactionOrder | undefined>(
      (await this.transactionService.transaction.get(orderRef)).data()
    );

    if (!order) {
      return;
    }

    // This happens here on purpose instead of cron to reduce $$$
    const expireDate = dayjs(order.payload.expiresOn?.toDate());
    let expired = false;
    if (expireDate.isBefore(dayjs(), 'ms')) {
      await this.markAsVoid(order);
      expired = true;
    }

    // Let's process this.'
    const match = await this.transactionService.isMatch(tran, tranOutput, order, soonTransaction);
    if (!expired && order.payload.reconciled === false && order.payload.void === false && match) {
      const expirationUnlock = this.transactionService.getExpirationUnlock(
        tranOutput.unlockConditions,
      );
      if (expirationUnlock !== undefined) {
        const type = tranOutput.nftOutput
          ? TransactionUnlockType.UNLOCK_NFT
          : TransactionUnlockType.UNLOCK_FUNDS;
        await this.transactionService.createUnlockTransaction(
          order,
          tran,
          tranOutput,
          type,
          tranOutput.outputId,
          dateToTimestamp(dayjs.unix(expirationUnlock.unixTime)),
        );
        return;
      }

      switch (order.payload.type) {
        case TransactionOrderType.NFT_PURCHASE:
          await this.nftService.handleNftPurchaseRequest(
            tran,
            tranOutput,
            order,
            match,
            soonTransaction,
          );
          break;
        case TransactionOrderType.NFT_BID:
          await this.nftService.handleNftBidRequest(
            tran,
            tranOutput,
            order,
            match,
            soonTransaction,
          );
          break;
        case TransactionOrderType.SPACE_ADDRESS_VALIDATION:
          await this.addressService.handleAddressValidationRequest(order, match, Entity.SPACE);
          break;
        case TransactionOrderType.MEMBER_ADDRESS_VALIDATION:
          await this.addressService.handleAddressValidationRequest(order, match, Entity.MEMBER);
          break;
        case TransactionOrderType.TOKEN_PURCHASE:
          await this.tokenService.handleTokenPurchaseRequest(order, match);
          break;
        case TransactionOrderType.TOKEN_AIRDROP:
          await this.tokenService.handleTokenAirdropClaim(order, match);
          break;
        case TransactionOrderType.AIRDROP_MINTED_TOKEN:
          await this.tokenService.handleMintedTokenAirdrop(order, tranOutput, match);
          break;
        case TransactionOrderType.MINT_TOKEN:
          await this.tokenMintService.handleMintingRequest(order, match);
          break;
        case TransactionOrderType.CLAIM_MINTED_TOKEN:
          await this.mintedTokenClaimService.handleClaimRequest(order, match);
          break;
        case TransactionOrderType.SELL_TOKEN:
        case TransactionOrderType.BUY_TOKEN:
          await this.tokenService.handleTokenTradeRequest(
            order,
            tranOutput,
            match,
            soonTransaction,
          );
          break;
        case TransactionOrderType.MINT_COLLECTION:
          await this.collectionMintingService.handleCollectionMintingRequest(order, match);
          break;
        case TransactionOrderType.DEPOSIT_NFT: {
          const service = new NftDepositService(this.transactionService);
          await service.handleNftDepositRequest(order, tranOutput, match);
          break;
        }
        case TransactionOrderType.CREDIT_LOCKED_FUNDS:
          await this.creditService.handleCreditUnrefundableOrder(order, match);
          break;
        case TransactionOrderType.STAKE:
          await this.stakeService.handleStakeOrder(order, match);
          break;
        case TransactionOrderType.TANGLE_REQUEST:
          await this.tangleRequestService.onTangleRequest(
            order,
            tran,
            tranOutput,
            match,
            soonTransaction,
          );
          break;
        case TransactionOrderType.PROPOSAL_VOTE:
          await this.votingService.handleTokenVoteRequest(order, match);
          break;
        case TransactionOrderType.CLAIM_SPACE: {
          const service = new SpaceService(this.transactionService);
          await service.handleSpaceClaim(order, match);
          break;
        }
        case TransactionOrderType.STAKE_NFT: {
          const service = new NftStakeService(this.transactionService);
          await service.handleNftStake(order, match, tranOutput);
          break;
        }
        case TransactionOrderType.FUND_AWARD: {
          const service = new AwardService(this.transactionService);
          await service.handleAwardFundingOrder(order, match);
          break;
        }
      }
    } else {
      await this.transactionService.processAsInvalid(tran, order, tranOutput, soonTransaction);
    }

    // Add linked transaction.
    this.transactionService.updates.push({
      ref: orderRef,
      data: {
        linkedTransactions: [
          ...(order.linkedTransactions || []),
          ...this.transactionService.linkedTransactions,
        ],
      },
      action: 'update',
    });
  }

  private findAllOrdersWithAddress = (address: IotaAddress) =>
    admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.ORDER)
      .where('payload.targetAddress', '==', address)
      .get();
}
