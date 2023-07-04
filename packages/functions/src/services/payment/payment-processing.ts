import {
  COL,
  Entity,
  IotaAddress,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Nft,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { build5Db } from '../../firebase/firestore/build5Db';
import { ITransaction } from '../../firebase/firestore/interfaces';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { AddressService } from './address-service';
import { AwardService } from './award/award-service';
import { CreditService } from './credit-service';
import { MetadataNftService } from './metadataNft-service';
import { CollectionMintingService } from './nft/collection-minting-service';
import { NftDepositService } from './nft/nft-deposit-service';
import { NftService } from './nft/nft-service';
import { NftStakeService } from './nft/nft-stake-service';
import { SpaceService } from './space/space-service';
import { StakeService } from './stake-service';
import { TangleRequestService } from './tangle-service/TangleRequestService';
import { ImportMintedTokenService } from './token/import-minted-token.service';
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

  constructor(transaction: ITransaction) {
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

  public markAsVoid = (transaction: Transaction) => this.nftService.markAsVoid(transaction);

  public markNftAsFinalized = (nft: Nft) => this.nftService.markNftAsFinalized(nft);

  public async processMilestoneTransactions(tran: MilestoneTransaction): Promise<void> {
    if (!tran.outputs?.length) {
      return;
    }
    const build5Transaction = isEmpty(tran.build5TransactionId)
      ? undefined
      : await build5Db().doc(`${COL.TRANSACTION}/${tran.build5TransactionId}`).get<Transaction>();
    for (const tranOutput of tran.outputs) {
      if (
        build5Transaction?.type !== TransactionType.UNLOCK &&
        tran.inputs.find((i) => tranOutput.address === i.address)
      ) {
        continue;
      }
      const orders = await this.findAllOrdersWithAddress(tranOutput.address);
      for (const order of orders) {
        await this.processOrderTransaction(tran, tranOutput, order.uid, build5Transaction);
      }
    }
  }

  private async processOrderTransaction(
    tran: MilestoneTransaction,
    tranOutput: MilestoneTransactionEntry,
    orderId: string,
    build5Transaction: Transaction | undefined,
  ): Promise<void> {
    const orderRef = build5Db().doc(`${COL.TRANSACTION}/${orderId}`);
    const order = await this.transactionService.get<Transaction>(orderRef);

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
    const match = await this.transactionService.isMatch(tran, tranOutput, order, build5Transaction);
    if (!expired && order.payload.reconciled === false && order.payload.void === false && match) {
      const expirationUnlock = this.transactionService.getExpirationUnlock(
        tranOutput.unlockConditions,
      );
      if (expirationUnlock !== undefined) {
        const type = tranOutput.nftOutput
          ? TransactionPayloadType.UNLOCK_NFT
          : TransactionPayloadType.UNLOCK_FUNDS;
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
        case TransactionPayloadType.NFT_PURCHASE:
          await this.nftService.handleNftPurchaseRequest(
            tran,
            tranOutput,
            order,
            match,
            build5Transaction,
          );
          break;
        case TransactionPayloadType.NFT_BID:
          await this.nftService.handleNftBidRequest(
            tran,
            tranOutput,
            order,
            match,
            build5Transaction,
          );
          break;
        case TransactionPayloadType.SPACE_ADDRESS_VALIDATION:
          await this.addressService.handleSpaceAddressValidationRequest(order, match);
          break;
        case TransactionPayloadType.MEMBER_ADDRESS_VALIDATION:
          await this.addressService.handleAddressValidationRequest(order, match, Entity.MEMBER);
          break;
        case TransactionPayloadType.TOKEN_PURCHASE:
          await this.tokenService.handleTokenPurchaseRequest(order, match);
          break;
        case TransactionPayloadType.TOKEN_AIRDROP:
          await this.tokenService.handleTokenAirdropClaim(order, match);
          break;
        case TransactionPayloadType.AIRDROP_MINTED_TOKEN:
          await this.tokenService.handleMintedTokenAirdrop(order, tranOutput, match);
          break;
        case TransactionPayloadType.MINT_TOKEN:
          await this.tokenMintService.handleMintingRequest(order, match);
          break;
        case TransactionPayloadType.CLAIM_MINTED_TOKEN:
          await this.mintedTokenClaimService.handleClaimRequest(order, match);
          break;
        case TransactionPayloadType.SELL_TOKEN:
        case TransactionPayloadType.BUY_TOKEN:
          await this.tokenService.handleTokenTradeRequest(
            order,
            tranOutput,
            match,
            build5Transaction,
          );
          break;
        case TransactionPayloadType.MINT_COLLECTION:
          await this.collectionMintingService.handleCollectionMintingRequest(order, match);
          break;
        case TransactionPayloadType.DEPOSIT_NFT: {
          const service = new NftDepositService(this.transactionService);
          await service.handleNftDepositRequest(order, tranOutput, match);
          break;
        }
        case TransactionPayloadType.CREDIT_LOCKED_FUNDS:
          await this.creditService.handleCreditUnrefundableOrder(order, match);
          break;
        case TransactionPayloadType.STAKE:
          await this.stakeService.handleStakeOrder(order, match);
          break;
        case TransactionPayloadType.TANGLE_REQUEST:
          await this.tangleRequestService.onTangleRequest(
            order,
            tran,
            tranOutput,
            match,
            build5Transaction,
          );
          break;
        case TransactionPayloadType.PROPOSAL_VOTE:
          await this.votingService.handleTokenVoteRequest(order, match);
          break;
        case TransactionPayloadType.CLAIM_SPACE: {
          const service = new SpaceService(this.transactionService);
          await service.handleSpaceClaim(order, match);
          break;
        }
        case TransactionPayloadType.STAKE_NFT: {
          const service = new NftStakeService(this.transactionService);
          await service.handleNftStake(order, match, tranOutput);
          break;
        }
        case TransactionPayloadType.FUND_AWARD: {
          const service = new AwardService(this.transactionService);
          await service.handleAwardFundingOrder(order, match);
          break;
        }
        case TransactionPayloadType.IMPORT_TOKEN: {
          const service = new ImportMintedTokenService(this.transactionService);
          await service.handleMintedTokenImport(order, match);
          break;
        }
        case TransactionPayloadType.MINT_METADATA_NFT: {
          const service = new MetadataNftService(this.transactionService);
          await service.handleMintMetadataNftRequest(order, match);
          break;
        }
      }
    } else {
      await this.transactionService.processAsInvalid(tran, order, tranOutput, build5Transaction);
    }

    // Add linked transaction.
    this.transactionService.push({
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
    build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.ORDER)
      .where('payload.targetAddress', '==', address)
      .get<Transaction>();
}
