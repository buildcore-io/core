import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  Network,
  Proposal,
  Token,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import admin from '../../../admin.config';
import { SmrWallet } from '../../../services/wallet/SmrWalletService';
import { WalletService } from '../../../services/wallet/wallet';
import { packBasicOutput } from '../../../utils/basic-output.utils';
import { isProdEnv } from '../../../utils/config.utils';
import { cOn, dateToTimestamp, serverTime } from '../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';

export const createVoteTransactionOrder = async (
  proposal: Proposal,
  owner: string,
  voteValues: number[],
  token: Token,
) => {
  const network = isProdEnv() ? Network.SMR : Network.RMS;
  const wallet = (await WalletService.newWallet(network)) as SmrWallet;
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const nativeToken = {
    id: token.mintingData?.tokenId!,
    amount: HexHelper.fromBigInt256(bigInt(Number.MAX_SAFE_INTEGER)),
  };
  const output = packBasicOutput(
    targetAddress.bech32,
    0,
    [nativeToken],
    wallet.info,
    targetAddress.bech32,
  );

  const voteOrder: Transaction = {
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: proposal.space,
    network,
    payload: {
      type: TransactionOrderType.PROPOSAL_VOTE,
      amount: Number(output.amount),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(getExpiresOn(proposal)),
      validationType: TransactionValidationType.ADDRESS,
      reconciled: false,
      void: false,
      chainReference: null,
      proposalId: proposal.uid,
      voteValues,
    },
    linkedTransactions: [],
  };
  const voteTransactionOrderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${voteOrder.uid}`);
  await voteTransactionOrderDocRef.create(cOn(voteOrder));
  return voteOrder;
};

const getExpiresOn = (proposal: Proposal) => {
  const endDate = dayjs(proposal.settings.endDate.toDate());
  const expiresOn = dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
  if (expiresOn.isAfter(endDate)) {
    return endDate;
  }
  return expiresOn;
};
