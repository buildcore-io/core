import dayjs from 'dayjs';
import { TransactionOrder } from '../../../interfaces/models';
import { COL, IotaAddress } from '../../../interfaces/models/base';
import { MilestoneTransaction, MilestoneTransactionEntry } from '../../../interfaces/models/milestone';
import { Nft } from '../../../interfaces/models/nft';
import { Entity, TransactionOrderType, TransactionType } from '../../../interfaces/models/transaction';
import admin from '../../admin.config';
import { AddressService } from './address-service';
import { NftService } from './nft-service';
import { TokenService } from './token-service';
import { TransactionService } from './transaction-service';


export class ProcessingService {
  private transactionService: TransactionService;
  private tokenService: TokenService
  private nftService: NftService
  private addressService: AddressService

  constructor(transaction: FirebaseFirestore.Transaction) {
    this.transactionService = new TransactionService(transaction)
    this.tokenService = new TokenService(this.transactionService)
    this.nftService = new NftService(this.transactionService)
    this.addressService = new AddressService(this.transactionService)
  }

  public submit = () => this.transactionService.submit()

  public markAsVoid = (transaction: TransactionOrder) => this.nftService.markAsVoid(transaction)

  public markNftAsFinalized = (nft: Nft) => this.nftService.markNftAsFinalized(nft)

  public async processMilestoneTransactions(tran: MilestoneTransaction): Promise<void> {
    if (!tran.outputs?.length) {
      return;
    }
    for (const tranOutput of tran.outputs) {
      // Ignore output that contains input address. Remaining balance.
      if (tran.inputs.find((i) => tranOutput.address === i.address)) {
        continue;
      }
      const orders = await this.findAllOrdersWithAddress(tranOutput.address);
      // Technically there should only be one as address is unique per order.
      for (const order of orders.docs) {
        await this.processOrderTransaction(tran, tranOutput, order.id)
      }
    }
  }

  private async processOrderTransaction(tran: MilestoneTransaction, tranOutput: MilestoneTransactionEntry, orderId: string): Promise<void> {
    // Let's read the ORDER so we lock it for read. This is important to avoid concurrent processes.
    const orderRef = admin.firestore().collection(COL.TRANSACTION).doc(orderId);
    const order = <TransactionOrder | undefined>(await this.transactionService.transaction.get(orderRef)).data()

    if (!order) {
      return
    }

    // This happens here on purpose instead of cron to reduce $$$
    const expireDate = dayjs(order.payload.expiresOn?.toDate());
    let expired = false;
    if (expireDate.isBefore(dayjs(), 'ms')) {
      await this.markAsVoid(order);
      expired = true;
    }

    // Let's process this.'
    const match = this.transactionService.isMatch(tran, order.payload.targetAddress, order.payload.amount, order.payload.validationType);
    if (!expired && order.payload.reconciled === false && order.payload.void === false && match) {
      switch (order.payload.type) {
        case TransactionOrderType.NFT_PURCHASE:
          await this.nftService.handleNftPurchaseRequest(tran, tranOutput, order, match);
          break;
        case TransactionOrderType.NFT_BID:
          await this.nftService.handleNftBidRequest(tran, tranOutput, order, match);
          break;
        case TransactionOrderType.SPACE_ADDRESS_VALIDATION:
          await this.addressService.handleAddressValidationRequest(order, match, Entity.SPACE)
          break;
        case TransactionOrderType.MEMBER_ADDRESS_VALIDATION:
          await this.addressService.handleAddressValidationRequest(order, match, Entity.MEMBER)
          break;
        case TransactionOrderType.TOKEN_PURCHASE:
          await this.tokenService.handleTokenPurchaseRequest(order, match)
          break;
        case TransactionOrderType.TOKEN_AIRDROP:
          await this.tokenService.handleTokenAirdrop(order, match)
          break;
        case TransactionOrderType.TOKEN_BUY:
          await this.tokenService.handleTokenBuyRequest(order, match)
          break;
        case TransactionOrderType.MINT_TOKEN:
          await this.tokenService.handleTokenMintingRequest(order, match)
          break;
      }
    } else {
      // Now process all invalid orders.
      // Wrong amount, Double payments & Expired orders.
      this.transactionService.processAsInvalid(tran, order, tranOutput);
    }

    // Add linked transaction.
    this.transactionService.updates.push({
      ref: orderRef,
      data: { linkedTransactions: [...(order.linkedTransactions || []), ...this.transactionService.linkedTransactions] },
      action: 'update'
    });
  }

  private findAllOrdersWithAddress = (address: IotaAddress) =>
    admin.firestore().collection(COL.TRANSACTION).where('type', '==', TransactionType.ORDER).where('payload.targetAddress', '==', address).get();

}
