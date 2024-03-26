import { build5Db } from '@build-5/database';
import {
  COL,
  MintMetadataNftRequest,
  Network,
  SUB_COL,
  SpaceGuardian,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { createMetadataNftMintData } from '../../services/payment/tangle-service/metadataNft/mint-metadata-nft.service';
import { WalletService } from '../../services/wallet/wallet.service';
import { EMPTY_NFT_ID } from '../../utils/collection-minting-utils/nft.utils';
import { generateRandomAmount } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { EMPTY_ALIAS_ID } from '../../utils/token-minting-utils/alias.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const mintMetadataNftControl = async ({
  owner,
  params,
  project,
}: Context<MintMetadataNftRequest>): Promise<Transaction> => {
  const wallet = await WalletService.newWallet(params.network as Network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const {
    aliasId,
    aliasOutputAmount,
    collectionId,
    collectionOutputAmount,
    nftId,
    nftOutputAmount,
    space,
  } = await createMetadataNftMintData(project, owner, wallet, params);

  const amount = aliasOutputAmount + collectionOutputAmount + nftOutputAmount;

  const batch = build5Db().batch();

  if (aliasId === EMPTY_ALIAS_ID) {
    const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
    batch.create(spaceDocRef, space);

    const guardian: SpaceGuardian = {
      uid: owner,
      parentId: space.uid,
      parentCol: COL.SPACE,
      createdOn: dateToTimestamp(dayjs()),
    };
    const guardianDocRef = build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, owner);
    batch.create(guardianDocRef, guardian);

    const memberDocRef = build5Db().doc(COL.SPACE, space.uid, SUB_COL.MEMBERS, owner);
    batch.create(memberDocRef, guardian);
  }

  const order: Transaction = {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: space.uid,
    network: params.network as Network,
    payload: {
      type:
        nftId === EMPTY_NFT_ID
          ? TransactionPayloadType.MINT_METADATA_NFT
          : TransactionPayloadType.UPDATE_MINTED_NFT,
      amount: amount || generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      reconciled: false,
      void: false,
      aliasId: aliasId === EMPTY_ALIAS_ID ? '' : aliasId,
      aliasOutputAmount,
      collectionId: collectionId === EMPTY_NFT_ID ? '' : collectionId,
      collectionOutputAmount,
      nftId: nftId === EMPTY_NFT_ID ? '' : nftId,
      nftOutputAmount,
      metadata: params.metadata as { [key: string]: unknown },
    },
  };
  const orderDocRef = build5Db().doc(COL.TRANSACTION, order.uid);
  batch.create(orderDocRef, order);

  await batch.commit();

  return <Transaction>await orderDocRef.get();
};
