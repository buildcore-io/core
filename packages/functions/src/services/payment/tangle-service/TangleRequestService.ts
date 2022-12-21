import { IBasicOutput, IMetadataFeature, METADATA_FEATURE_TYPE } from '@iota/iota.js-next';
import { Converter as ConverterNext } from '@iota/util.js-next';
import {
  COL,
  Member,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  TangleRequestType,
  Transaction,
  TransactionOrder,
  URL_PATHS,
  WenError,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { get } from 'lodash';
import admin from '../../../admin.config';
import { cOn } from '../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../utils/error.utils';
import { getRandomNonce } from '../../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from '../transaction-service';
import { TangleAddressValidationService } from './address-validation.service';
import { TangleStakeService } from './stake.service';
import { TangleTokenTradeService } from './token-trade.service';

export class TangleRequestService {
  private addressValidationService: TangleAddressValidationService;
  private tokenTradeService: TangleTokenTradeService;
  private stakeService: TangleStakeService;

  constructor(readonly transactionService: TransactionService) {
    this.addressValidationService = new TangleAddressValidationService(transactionService);
    this.tokenTradeService = new TangleTokenTradeService(transactionService);
    this.stakeService = new TangleStakeService(transactionService);
  }

  public onTangleRequest = async (
    order: TransactionOrder,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    match: TransactionMatch,
  ) => {
    let owner = match.from.address;
    let payment: Transaction | undefined;

    try {
      owner = await this.getOwner(match.from.address, order.network!);
      payment = this.transactionService.createPayment({ ...order, member: owner }, match);
      const request = await this.getSoonTangleRequest(tranEntry);
      const response = await this.handleTangleRequest(
        order,
        match,
        payment,
        tran,
        tranEntry,
        owner,
        request,
      );
      if (response) {
        this.transactionService.createTangleCredit(payment, match, response, tranEntry.outputId!);
      }
    } catch (error) {
      functions.logger.warn(owner, error);
      if (!payment) {
        payment = this.transactionService.createPayment({ ...order, member: owner }, match);
      }
      this.transactionService.createTangleCredit(
        payment,
        match,
        { status: 'error', error: get(error, 'details.code', 1000) },
        tranEntry.outputId!,
      );
    }
  };

  public handleTangleRequest = async (
    order: TransactionOrder,
    match: TransactionMatch,
    payment: Transaction,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
  ) => {
    switch (request.requestType) {
      case TangleRequestType.ADDRESS_VALIDATION:
        return await this.addressValidationService.handeAddressValidation(
          order,
          tran,
          tranEntry,
          owner,
          request,
        );
      case TangleRequestType.BUY_TOKEN:
      case TangleRequestType.SELL_TOKEN:
        return await this.tokenTradeService.handleTokenTradeTangleRequest(
          match,
          payment,
          tran,
          tranEntry,
          owner,
          request,
        );
      case TangleRequestType.STAKE:
        return await this.stakeService.handleStaking(tran, tranEntry, owner, request);
      default:
        throw throwInvalidArgument(WenError.unknown);
    }
  };

  private getOwner = async (senderAddress: string, network: Network) => {
    const snap = await admin
      .firestore()
      .collection(COL.MEMBER)
      .where(`validatedAddress.${network}`, '==', senderAddress)
      .get();

    if (snap.size > 1) {
      throw throwInvalidArgument(WenError.multiple_members_with_same_address);
    }

    if (snap.size === 1) {
      return snap.docs[0].id;
    }

    const docRef = admin.firestore().doc(`${COL.MEMBER}/${senderAddress}`);
    const member = <Member | undefined>(await docRef.get()).data();
    if (!member) {
      const memberData = {
        uid: senderAddress,
        nonce: getRandomNonce(),
        validatedAddress: {
          [network as string]: senderAddress,
        },
      };
      await docRef.create(cOn(memberData, URL_PATHS.MEMBER));
    }

    return senderAddress;
  };

  private getSoonTangleRequest = (tranEntry: MilestoneTransactionEntry) => {
    try {
      const output: IBasicOutput | undefined = tranEntry.output;
      const metadataFeature = <IMetadataFeature | undefined>(
        output?.features?.find((f) => f.type === METADATA_FEATURE_TYPE)
      );
      const decoded = ConverterNext.hexToUtf8(metadataFeature?.data || '{}');
      const metadata = JSON.parse(decoded);
      return metadata.request || {};
    } catch (e) {
      return {};
    }
  };
}
