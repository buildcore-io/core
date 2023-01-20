import {
  COL,
  Network,
  Proposal,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../../admin.config';
import { WalletService } from '../../../services/wallet/wallet';
import { generateRandomAmount } from '../../../utils/common.utils';
import { isProdEnv } from '../../../utils/config.utils';
import { cOn, dateToTimestamp, serverTime } from '../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';

export const createVoteTransactionOrder = async (
  proposal: Proposal,
  owner: string,
  voteValues: number[],
) => {
  const network = isProdEnv() ? Network.SMR : Network.RMS;
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const voteOrder: Transaction = {
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: proposal.space,
    network,
    payload: {
      type: TransactionOrderType.PROPOSAL_VOTE,
      amount: generateRandomAmount(),
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
