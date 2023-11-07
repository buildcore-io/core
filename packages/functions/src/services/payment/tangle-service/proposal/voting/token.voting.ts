import {
  Network,
  Proposal,
  TRANSACTION_AUTO_EXPIRY_MS,
  Token,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { packBasicOutput } from '../../../../../utils/basic-output.utils';
import { isProdEnv } from '../../../../../utils/config.utils';
import { dateToTimestamp } from '../../../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../../../utils/wallet.utils';
import { WalletService } from '../../../../wallet/wallet.service';

export const createVoteTransactionOrder = async (
  project: string,
  owner: string,
  proposal: Proposal,
  voteValues: number[],
  token: Token,
): Promise<Transaction> => {
  const network = isProdEnv() ? Network.SMR : Network.RMS;
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const nativeToken = {
    id: token.mintingData?.tokenId!,
    amount: BigInt(Number.MAX_SAFE_INTEGER),
  };
  const output = await packBasicOutput(wallet, targetAddress.bech32, 0, {
    nativeTokens: [nativeToken],
    storageDepositReturnAddress: targetAddress.bech32,
  });

  return {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: proposal.space,
    network,
    payload: {
      type: TransactionPayloadType.PROPOSAL_VOTE,
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
};

const getExpiresOn = (proposal: Proposal) => {
  const endDate = dayjs(proposal.settings.endDate.toDate());
  const expiresOn = dayjs().add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
  if (expiresOn.isAfter(endDate)) {
    return endDate;
  }
  return expiresOn;
};
