import { build5Db } from '@build-5/database';
import {
  COL,
  MintMetadataNftRequest,
  MintMetadataNftTangleRequest,
  NftStatus,
  SUB_COL,
  Space,
  TRANSACTION_AUTO_EXPIRY_MS,
  TangleResponse,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import { AliasAddress, Ed25519Address, NftAddress, NftOutput } from '@iota/sdk';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { packBasicOutput } from '../../../../utils/basic-output.utils';
import {
  EMPTY_NFT_ID,
  createNftOutput,
  getNftByMintingId,
} from '../../../../utils/collection-minting-utils/nft.utils';
import { getProject } from '../../../../utils/common.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { getAliasId, getIssuerNftId } from '../../../../utils/nft.output.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getSpaceByAliasId } from '../../../../utils/space.utils';
import {
  EMPTY_ALIAS_ID,
  createAliasOutput,
} from '../../../../utils/token-minting-utils/alias.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { Wallet } from '../../../wallet/wallet';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { metadataNftSchema } from './MetadataNftTangleRequestSchema';

export class MintMetadataNftService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    project,
    owner,
    request,
    match,
    tran,
    tranEntry,
    order: tangleOrder,
    payment,
  }: HandlerParams): Promise<TangleResponse> => {
    const params = await assertValidationAsync(metadataNftSchema, request);

    const wallet = await WalletService.newWallet(tangleOrder.network);
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

    const remainingAmount = match.to.amount - amount;
    const remainderOutput = await packBasicOutput(wallet, targetAddress.bech32, remainingAmount, {
      customMetadata: { nftId, collectionId, aliasId },
      tag: match.msgId,
    });

    if (remainingAmount !== Number(remainderOutput.amount)) {
      return {
        status: 'error',
        code: WenError.invalid_base_token_amount.code,
        message: WenError.invalid_base_token_amount.key,
        amount: amount,
      };
    }

    if (aliasId === EMPTY_ALIAS_ID) {
      const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
      this.transactionService.push({ ref: spaceDocRef, data: space, action: Action.C });

      const guardian = {
        uid: owner,
        parentId: space.uid,
        parentCol: COL.SPACE,
        createdOn: dateToTimestamp(dayjs()),
      };
      const guardianDocRef = build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, owner);
      this.transactionService.push({ ref: guardianDocRef, data: guardian, action: Action.C });

      const memberDocRef = build5Db().doc(COL.SPACE, space.uid, SUB_COL.MEMBERS, owner);
      this.transactionService.push({ ref: memberDocRef, data: guardian, action: Action.C });
    }

    const order: Transaction = {
      project: getProject(tangleOrder),
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: space.uid,
      network: tangleOrder.network,
      payload: {
        type: TransactionPayloadType.MINT_METADATA_NFT,
        amount: match.to.amount,
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
        metadata: request.metadata as { [key: string]: unknown },
        tag: match.msgId,
      },
    };
    const orderDocRef = build5Db().doc(COL.TRANSACTION, order.uid);
    this.transactionService.push({ ref: orderDocRef, data: order, action: Action.C });

    this.transactionService.createUnlockTransaction(
      payment,
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );

    return {};
  };
}

export const createMetadataNftMintData = async (
  project: string,
  owner: string,
  wallet: Wallet,
  params: MintMetadataNftRequest | MintMetadataNftTangleRequest,
) => {
  const { nftId, collectionId, aliasId } = await getIds(
    wallet,
    params.nftId,
    params.collectionId,
    params.aliasId,
  );

  const space = await getSpace(project, owner, aliasId);
  const aliasOutputAmount = await getAliasOutputAmount(owner, space, wallet);
  const collectionOutputAmount = await getCollectionOutputAmount(aliasId, collectionId, wallet);
  const nftOutputAmount = await getNftOutputAmount(collectionId, nftId, params.metadata, wallet);

  return {
    nftId,
    collectionId,
    aliasId,
    space,
    aliasOutputAmount,
    collectionOutputAmount,
    nftOutputAmount,
  };
};

const getAliasOutputAmount = async (owner: string, space: Space, wallet: Wallet) => {
  const targetAddress = await wallet.getNewIotaAddressDetails();
  if (isEmpty(space.alias)) {
    const aliasOutput = await createAliasOutput(wallet, targetAddress);
    return Number(aliasOutput.amount);
  }

  if (!space.alias?.address) {
    throw invalidArgument(WenError.not_alias_governor);
  }
  const guardianDocRef = build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, owner);
  const guardian = await guardianDocRef.get();

  if (!guardian) {
    throw invalidArgument(WenError.not_alias_governor);
  }

  return 0;
};

const getCollectionOutputAmount = async (aliasId: string, collectionId: string, wallet: Wallet) => {
  if (collectionId === EMPTY_NFT_ID) {
    const issuerAddress = new AliasAddress(aliasId);
    const collectionOutput = await createNftOutput(wallet, issuerAddress, issuerAddress, '');
    return Number(collectionOutput.amount);
  }
  return 0;
};

const createMetadataNftOutput = async (wallet: Wallet, collectionId: string, metadata: object) => {
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const issuerAddress = new NftAddress(collectionId);
  const ownerAddress = new Ed25519Address(targetAddress.hex);
  return createNftOutput(
    wallet,
    ownerAddress,
    issuerAddress,
    '',
    undefined,
    JSON.stringify(metadata),
  );
};

const getSpace = async (project: string, owner: string, aliasId: string) => {
  if (aliasId === EMPTY_ALIAS_ID) {
    return {
      project,
      uid: getRandomEthAddress(),
      name: `Space of alias: ${aliasId}`,
      open: false,
      createdBy: owner,
      totalGuardians: 1,
      totalMembers: 1,
      totalPendingMembers: 0,
      guardians: {},
      members: {},
    };
  }

  const space = await getSpaceByAliasId(aliasId);
  if (!space || !space.alias?.address) {
    throw invalidArgument(WenError.alias_not_deposited);
  }
  return space;
};

const getNftOutputAmount = async (
  collectionId: string,
  nftId: string,
  metadata: object,
  wallet: Wallet,
) => {
  if (nftId === EMPTY_NFT_ID) {
    const nftOutput = await createMetadataNftOutput(wallet, collectionId, metadata);
    return Number(nftOutput.amount);
  }
  const nft = await getNftByMintingId(nftId);
  if (nft?.status === NftStatus.MINTED) {
    return 0;
  }
  throw invalidArgument(WenError.nft_not_deposited);
};

const getIds = async (
  wallet: Wallet,
  nftId = EMPTY_NFT_ID,
  collectionId = EMPTY_NFT_ID,
  aliasId = EMPTY_ALIAS_ID,
) => {
  if (nftId !== EMPTY_NFT_ID) {
    const collectionId = await getCollectionId(wallet, nftId);
    const collectionOutput = await getCollectionOutput(wallet, collectionId);
    const aliasId = getAliasId(collectionOutput);
    return { nftId, collectionId: collectionOutput.nftId, aliasId };
  }

  if (collectionId !== EMPTY_NFT_ID) {
    const collectionOutput = await getCollectionOutput(wallet, collectionId);
    const aliasId = getAliasId(collectionOutput);
    return { nftId: EMPTY_NFT_ID, collectionId, aliasId };
  }

  return { nftId: EMPTY_NFT_ID, collectionId: EMPTY_NFT_ID, aliasId };
};

const getCollectionId = async (wallet: Wallet, nftId: string) => {
  try {
    const nftOutputId = await wallet.client.nftOutputId(nftId);
    const nftOutput = (await wallet.client.getOutput(nftOutputId)).output as NftOutput;
    return getIssuerNftId(nftOutput);
  } catch {
    throw invalidArgument(WenError.invalid_nft_id);
  }
};

const getCollectionOutput = async (wallet: Wallet, collectionId: string) => {
  try {
    const collectionOutputId = await wallet.client.nftOutputId(collectionId);
    return (await wallet.client.getOutput(collectionOutputId)).output as NftOutput;
  } catch {
    throw invalidArgument(WenError.invalid_collection_id);
  }
};
