import { ITransaction, build5Db } from '@build-5/database';
import {
  COL,
  Entity,
  Member,
  Nft,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import { get, head, isEmpty } from 'lodash';
import { getAddress } from '../../../utils/address.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { createNftWithdrawOrder } from '../tangle-service/nft/nft-purchase.service';
import { assertCanBeWithdrawn } from './nft-withdraw.service';

interface NftTransfer {
  nft: string;
  target: string;
  withdraw?: boolean;
}

interface NftTransferResponse {
  code: number;
  nftUpdateData?: unknown;
  order?: Transaction;
}

export const createNftTransferData = async (
  transaction: ITransaction,
  project: string,
  owner: string,
  transfers: NftTransfer[],
) => {
  const members: { [uid: string]: Member } = {};

  const getTarget = async (nft: Nft, transfer: NftTransfer) => {
    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${transfer.target}`);
    const member = members[transfer.target] || (await memberDocRef.get<Member>());

    if (member) {
      members[transfer.target] = member;
      const targetAddress = transfer.withdraw ? getAddress(member, nft.mintingData?.network!) : '';
      const withdraw = (transfer.withdraw || false) && !isEmpty(targetAddress);
      return { targetAddress, withdraw };
    }

    return { targetAddress: transfer.target, withdraw: true };
  };

  const results = transfers.map(
    async (transfer): Promise<{ [key: string]: NftTransferResponse }> => {
      const nft = await getNft(transaction, transfer.nft);
      if (!nft) {
        return { [transfer.nft]: { code: WenError.nft_does_not_exists.code } };
      }

      try {
        assertCanBeWithdrawn(nft, owner);
      } catch (error) {
        return { [transfer.nft]: { code: get(error, 'details.code', 0) } };
      }

      const { targetAddress, withdraw } = await getTarget(nft, transfer);

      const network = nft.mintingData!.network!;

      if (!withdraw) {
        const order: Transaction = {
          project,
          type: TransactionType.NFT_TRANSFER,
          uid: getRandomEthAddress(),
          member: owner,
          space: nft.space,
          network,
          payload: {
            amount: nft.depositData?.storageDeposit || nft.mintingData?.storageDeposit || 0,
            beneficiary: Entity.MEMBER,
            beneficiaryUid: transfer.target,
            previousOwner: nft.owner || '',
            previousOwnerEntity: nft.owner ? Entity.MEMBER : Entity.SPACE,
            ownerEntity: Entity.MEMBER,
            owner: transfer.target,
            nft: nft.uid,
            collection: nft.collection,
          },
        };
        return { [transfer.nft]: { code: 200, nftUpdateData: { owner: transfer.target }, order } };
      } else if (!targetAddress.startsWith(network)) {
        return { [transfer.nft]: { code: WenError.invalid_target_address.code } };
      }

      const { order, nftUpdateData } = createNftWithdrawOrder(project, nft, owner, targetAddress);
      return { [transfer.nft]: { code: 200, nftUpdateData: nftUpdateData, order } };
    },
  );

  return (await Promise.all(results)).reduce((acc, act) => ({ ...acc, ...act }), {});
};

const getNft = async (transaction: ITransaction, uidOrTangleId: string) => {
  const nftDocRef = build5Db().doc(`${COL.NFT}/${uidOrTangleId}`);
  const nft = await transaction.get<Nft>(nftDocRef);
  if (nft) {
    return nft;
  }
  const snap = await build5Db()
    .collection(COL.NFT)
    .where('mintingData.nftId', '==', uidOrTangleId)
    .get<Nft>();
  return head(snap);
};
