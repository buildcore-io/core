import { database } from '@buildcore/database';
import {
  COL,
  Entity,
  Member,
  Network,
  Swap,
  SwapCreateRequest,
  SwapCreateTangleRequest,
  SwapOutput,
  SwapStatus,
  TRANSACTION_MAX_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { get, head, isEmpty, isEqual } from 'lodash';
import { getAddress } from '../../../utils/address.utils';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { invalidArgument } from '../../../utils/error.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { Wallet } from '../../wallet/wallet';
import { BaseService, HandlerParams } from '../base';
import { Action, TransactionMatch } from '../transaction-service';

export class SwapService extends BaseService {
  handleRequest = async ({ project, order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);

    const swapDocRef = database().doc(COL.SWAP, order.payload.swap!);
    const swap = <Swap>await this.transaction.get(swapDocRef);

    if (swap.status == SwapStatus.FULFILLED || swap.status === SwapStatus.REJECTED) {
      this.createCredit(payment, match);
      return;
    }

    const swapOutput: SwapOutput = {
      amount: match.to.amount,
      nftId: match.to.nftOutput?.nftId || '',
      nativeTokens: match.to.nativeTokens || [],
      outputId: match.to.outputId!,
      fromAddress: match.from,
      payment: payment.uid,
    };

    const fieldName = this.getUpdateFieldName(swap, swapOutput);
    this.transactionService.push({
      ref: swapDocRef,
      data: { [fieldName]: JSON.stringify([...get(swap, fieldName, []), swapOutput]) },
      action: Action.U,
    });

    if (fieldName !== 'askOutputs') {
      return;
    }

    const askOutputs = (swap.askOutputs || []).concat(swapOutput);
    if (swap.status !== SwapStatus.FUNDED || !asksAreFulfilled({ ...swap, askOutputs })) {
      return;
    }

    const transfers = await createSwapTransfers(project, { ...swap, askOutputs });
    for (const transfer of transfers) {
      const docRef = database().doc(COL.TRANSACTION, transfer.uid);
      this.transactionService.push({ ref: docRef, data: transfer, action: Action.C });
    }

    this.transactionService.push({
      ref: swapDocRef,
      data: { status: SwapStatus.FULFILLED },
      action: Action.U,
    });
  };

  private getUpdateFieldName = (swap: Swap, swapOutput: SwapOutput) => {
    if (swapOutput.nftId) {
      return swap.nftIdsAsk.includes(swapOutput.nftId) ? 'askOutputs' : 'bidOutputs';
    }
    const nativeTokens = swapOutput.nativeTokens || [];
    if (!isEmpty(nativeTokens)) {
      return swap.nativeTokensAsk.map((nt) => nt.id).includes(head(nativeTokens)?.id || '')
        ? 'askOutputs'
        : 'bidOutputs';
    }
    return swap.baseTokenAmountAsk ? 'askOutputs' : 'bidOutputs';
  };

  private createCredit = (payment: Transaction, match: TransactionMatch) => {
    if (match.to.nftOutput?.nftId) {
      this.transactionService.createNftCredit(payment, match);
      return;
    }
    this.transactionService.createCredit(TransactionPayloadType.SWAP, payment, match);
    const paymentDocRef = database().doc(COL.TRANSACTION, payment.uid);
    this.transactionService.push({
      ref: paymentDocRef,
      data: { payload_invalidPayment: true },
      action: Action.U,
    });
  };
}

export const validateSwapAsk = async (wallet: Wallet, params: SwapCreateRequest) => {
  for (const nativeToken of params.nativeTokens || []) {
    try {
      await wallet.client.foundryOutputId(nativeToken.id);
    } catch {
      throw invalidArgument(WenError.invalid_foundry);
    }
  }
};

export const createSwapOrder = async (
  wallet: Wallet,
  project: string,
  owner: string,
  network: Network,
  targetAddress: string,
  params: SwapCreateRequest | SwapCreateTangleRequest,
  bids: SwapOutput[] = [],
) => {
  const swapId = getRandomEthAddress();
  const order: Transaction = {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    network,
    payload: {
      type: TransactionPayloadType.SWAP,
      amount: 0,
      targetAddress,
      validationType: TransactionValidationType.ADDRESS,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_MAX_EXPIRY_MS)),
      reconciled: false,
      void: false,
      swap: swapId,
    },
  };

  const promises = (params.nfts || []).map((nft) => getNftTangleId(wallet, nft));

  const swap: Swap = {
    recipient: params.recipient,
    project,
    createdBy: owner,
    uid: swapId,

    network,
    address: targetAddress,
    orderId: order.uid,

    bidOutputs: bids,

    nftIdsAsk: await Promise.all(promises),
    baseTokenAmountAsk: params.baseTokenAmount || 0,
    nativeTokensAsk: params.nativeTokens?.map((nt) => ({ ...nt, amount: BigInt(nt.amount) })) || [],

    status: get(params, 'setFunded', false) ? SwapStatus.FUNDED : SwapStatus.DRAFT,
  };

  return { order, swap };
};

const getNftTangleId = async (wallet: Wallet, uidOrTangleId: string) => {
  const docRef = database().doc(COL.NFT, uidOrTangleId);
  const nft = await docRef.get();
  if (nft?.mintingData?.nftId) {
    return nft.mintingData.nftId;
  }
  try {
    await wallet.client.nftOutputId(uidOrTangleId);
  } catch {
    throw invalidArgument(WenError.invalid_nft_id);
  }
  return uidOrTangleId;
};

export const assertSwapCanBeSetAsFunded = (owner: string, swap: Swap | undefined) => {
  if (!swap) {
    throw invalidArgument(WenError.invalid_swap_uid);
  }

  if (swap.createdBy !== owner) {
    throw invalidArgument(WenError.not_swap_owner);
  }

  if (isEmpty(swap.bidOutputs)) {
    throw invalidArgument(WenError.swap_must_be_funded);
  }
};

const assertSwapCanBeRejected = (owner: string, swap: Swap | undefined) => {
  if (!swap) {
    throw invalidArgument(WenError.invalid_swap_uid);
  }

  if (![swap.createdBy, swap.recipient].includes(owner)) {
    throw invalidArgument(WenError.not_swap_owner);
  }

  if (swap.status === SwapStatus.FULFILLED) {
    throw invalidArgument(WenError.swap_already_fulfilled);
  }

  if (swap.status === SwapStatus.REJECTED) {
    throw invalidArgument(WenError.swap_already_fulfilled);
  }
};

export const rejectSwap = (project: string, owner: string, swap: Swap | undefined) => {
  assertSwapCanBeRejected(owner, swap);
  const bidCredits = (swap!.bidOutputs || []).map((bid) => {
    const func = bid.nftId ? createNftTransfer : createAssetTransfer;
    return func(project, swap!, bid.fromAddress, bid.fromAddress, bid, bid.fromAddress, true);
  });
  const askCredits = (swap!.askOutputs || []).map((ask) => {
    const func = ask.nftId ? createNftTransfer : createAssetTransfer;
    return func(project, swap!, ask.fromAddress, ask.fromAddress, ask, ask.fromAddress, true);
  });
  return [...bidCredits, ...askCredits];
};

const createNftTransfer = (
  project: string,
  swap: Swap,
  sender: string,
  receiver: string,
  output: SwapOutput,
  targetAddress: string,
  isCredit = false,
): Transaction => ({
  project,
  type: isCredit ? TransactionType.CREDIT_NFT : TransactionType.WITHDRAW_NFT,
  uid: getRandomEthAddress(),
  member: receiver,
  space: '',
  network: swap.network,
  payload: {
    amount: output.amount,
    beneficiary: Entity.MEMBER,
    beneficiaryUid: receiver,
    previousOwner: sender,
    previousOwnerEntity: Entity.MEMBER,
    nftId: output.nftId,
    outputToConsume: output.outputId,
    sourceAddress: swap.address,
    targetAddress,
    swap: swap.uid,
    sourceTransaction: [output.payment],
  },
});

const createAssetTransfer = (
  project: string,
  swap: Swap,
  sender: string,
  receiver: string,
  output: SwapOutput,
  targetAddress: string,
  isCredit = false,
): Transaction => ({
  project,
  type: isCredit ? TransactionType.CREDIT : TransactionType.BILL_PAYMENT,
  uid: getRandomEthAddress(),
  member: receiver,
  space: '',
  network: swap.network,
  payload: {
    amount: output.amount,
    nativeTokens: output.nativeTokens || [],
    beneficiary: Entity.MEMBER,
    beneficiaryUid: receiver,
    previousOwner: sender,
    previousOwnerEntity: Entity.MEMBER,
    outputToConsume: output.outputId,
    sourceAddress: swap.address,
    targetAddress,
    swap: swap.uid,
    sourceTransaction: [output.payment],
  },
});

export const asksAreFulfilled = (swap: Swap) => {
  const nftIds = (swap.askOutputs || [])
    .map((o) => o.nftId || '')
    .filter((id) => !isEmpty(id))
    .sort();
  if (!isEqual(nftIds, swap.nftIdsAsk.sort())) {
    return false;
  }
  const nativeTokensSent = (swap.askOutputs || []).reduce(
    (acc, act) => {
      for (const nt of act.nativeTokens || []) {
        acc[nt.id] = (acc[nt.id] || 0) + Number(nt.amount);
      }
      return acc;
    },
    {} as { [key: string]: number },
  );
  const nativeTokensAsked = swap.nativeTokensAsk.reduce(
    (acc, act) => ({ ...acc, [act.id]: Number(act.amount) }),
    {} as { [key: string]: number },
  );
  for (const [id, amount] of Object.entries(nativeTokensAsked)) {
    if (amount !== nativeTokensSent[id]) {
      return false;
    }
  }

  const baseTokensSent = (swap.askOutputs || [])
    .filter((o) => isEmpty(o.nftId))
    .reduce((acc, act) => acc + act.amount, 0);
  if (swap.baseTokenAmountAsk && baseTokensSent < swap.baseTokenAmountAsk) {
    return false;
  }

  return true;
};

export const createSwapTransfers = async (project: string, swap: Swap) => {
  const targetMemberDocRef = database().doc(COL.MEMBER, swap.recipient);
  const targetMember = <Member>await targetMemberDocRef.get();

  const bidTransfers = (swap.bidOutputs || []).map((bid) => {
    const func = bid.nftId ? createNftTransfer : createAssetTransfer;
    return func(
      project,
      swap,
      swap.createdBy!,
      targetMember.uid,
      bid,
      getAddress(targetMember, swap.network),
    );
  });

  const memberDocRef = database().doc(COL.MEMBER, swap.createdBy!);
  const mmber = <Member>await memberDocRef.get();
  const askTransfers = (swap.askOutputs || []).map((ask) => {
    const func = ask.nftId ? createNftTransfer : createAssetTransfer;
    return func(
      project,
      swap,
      targetMember.uid,
      swap.createdBy!,
      ask,
      getAddress(mmber, swap.network),
    );
  });
  return [...bidTransfers, ...askTransfers];
};
