import { build5Db } from '@build-5/database';
import {
  COL,
  MintMetadataNftTangleRequest,
  NftStatus,
  SUB_COL,
  Space,
  SpaceGuardian,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import {
  ALIAS_ADDRESS_TYPE,
  AddressTypes,
  ED25519_ADDRESS_TYPE,
  INftOutput,
  IndexerPluginClient,
  NFT_ADDRESS_TYPE,
} from '@iota/iota.js-next';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { packBasicOutput } from '../../../../utils/basic-output.utils';
import {
  EMPTY_NFT_ID,
  createNftOutput,
  getNftByMintingId,
} from '../../../../utils/collection-minting-utils/nft.utils';
import { getProject, getProjects } from '../../../../utils/common.utils';
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
import { SmrWallet } from '../../../wallet/SmrWalletService';
import { WalletService } from '../../../wallet/wallet';
import { BaseService, HandlerParams } from '../../base';
import { metadataNftSchema } from './MetadataNftTangleRequestSchema';

export class MintMetadataNftService extends BaseService {
  public handleRequest = async ({
    project,
    owner,
    request,
    match,
    tran,
    tranEntry,
    order: tangleOrder,
  }: HandlerParams) => {
    const params = await assertValidationAsync(metadataNftSchema, request);

    const wallet = (await WalletService.newWallet(tangleOrder.network)) as SmrWallet;
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const { nftId, collectionId, aliasId } = await getIds(params, wallet);

    const space = await getSpace(project, owner, aliasId);
    const aliasOutputAmount = await getAliasOutputAmount(owner, space, wallet);
    const collectionOutputAmount = await getCollectionOutputAmount(aliasId, collectionId, wallet);
    const nftOutputAmount = await getNftOutputAmount(collectionId, nftId, params.metadata, wallet);

    const amount = aliasOutputAmount + collectionOutputAmount + nftOutputAmount;

    const remainingAmount = match.to.amount - amount;
    const remainderOutput = packBasicOutput(
      targetAddress.bech32,
      remainingAmount,
      undefined,
      wallet.info,
      undefined,
      undefined,
      undefined,
      { nftId, collectionId, aliasId },
      match.msgId,
    );

    if (remainingAmount !== Number(remainderOutput.amount)) {
      return {
        status: 'error',
        code: WenError.invalid_base_token_amount.code,
        message: WenError.invalid_base_token_amount.key,
        amount: amount,
      };
    }

    if (aliasId === EMPTY_ALIAS_ID) {
      const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);
      this.transactionService.push({ ref: spaceDocRef, data: space, action: 'set' });

      const guardian = { uid: owner, parentId: space.uid, parentCol: COL.SPACE };
      const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner);
      this.transactionService.push({ ref: guardianDocRef, data: guardian, action: 'set' });

      const memberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner);
      this.transactionService.push({ ref: memberDocRef, data: guardian, action: 'set' });
    }

    const order: Transaction = {
      project: getProject(tangleOrder),
      projects: getProjects([tangleOrder]),
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
    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
    this.transactionService.push({ ref: orderDocRef, data: order, action: 'set' });

    this.transactionService.createUnlockTransaction(
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );
    return;
  };
}

const getAliasOutputAmount = async (owner: string, space: Space, wallet: SmrWallet) => {
  const targetAddress = await wallet.getNewIotaAddressDetails();
  if (isEmpty(space.alias)) {
    const aliasOutput = createAliasOutput(targetAddress, wallet.info);
    return Number(aliasOutput.amount);
  }

  if (!space.alias?.address) {
    throw invalidArgument(WenError.not_alias_governor);
  }
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);
  const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner);
  const guardian = await guardianDocRef.get<SpaceGuardian>();

  if (!guardian) {
    throw invalidArgument(WenError.not_alias_governor);
  }

  return 0;
};

const getCollectionOutputAmount = async (
  aliasId: string,
  collectionId: string,
  wallet: SmrWallet,
) => {
  if (collectionId === EMPTY_NFT_ID) {
    const issuerAddress: AddressTypes = { type: ALIAS_ADDRESS_TYPE, aliasId };
    const collectionOutput = createNftOutput(issuerAddress, issuerAddress, '', wallet.info);
    return Number(collectionOutput.amount);
  }
  return 0;
};

const createMetadataNftOutput = async (
  wallet: SmrWallet,
  collectionId: string,
  metadata: object,
) => {
  const targetAddress = await wallet.getNewIotaAddressDetails();
  const issuerAddress: AddressTypes = { type: NFT_ADDRESS_TYPE, nftId: collectionId };
  const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: targetAddress.hex };
  return createNftOutput(
    ownerAddress,
    issuerAddress,
    '',
    wallet.info,
    undefined,
    JSON.stringify(metadata),
  );
};

const getSpace = async (project: string, owner: string, aliasId: string) => {
  if (aliasId === EMPTY_ALIAS_ID) {
    return {
      project,
      projects: getProjects([], project),
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
  wallet: SmrWallet,
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

const getIds = async (request: MintMetadataNftTangleRequest, wallet: SmrWallet) => {
  const indexer = new IndexerPluginClient(wallet.client);
  const nftId = request.nftId as string;
  if (nftId) {
    const collectionId = await getCollectionId(wallet, indexer, nftId);
    const collectionOutput = await getCollectionOutput(wallet, indexer, collectionId);
    const aliasId = getAliasId(collectionOutput);
    return { nftId, collectionId: collectionOutput.nftId, aliasId };
  }

  const collectionId = request.collectionId as string;
  if (collectionId) {
    const collectionOutput = await getCollectionOutput(wallet, indexer, collectionId);
    const aliasId = getAliasId(collectionOutput);
    return { nftId: EMPTY_NFT_ID, collectionId, aliasId };
  }

  const aliasId = (request.aliasId as string) || EMPTY_ALIAS_ID;
  return { nftId: EMPTY_NFT_ID, collectionId: EMPTY_NFT_ID, aliasId };
};

const getCollectionId = async (wallet: SmrWallet, indexer: IndexerPluginClient, nftId: string) => {
  try {
    const nftOutputId = (await indexer.nft(nftId)).items[0];
    const nftOutput = (await wallet.client.output(nftOutputId)).output as INftOutput;
    return getIssuerNftId(nftOutput);
  } catch {
    throw invalidArgument(WenError.invalid_nft_id);
  }
};

const getCollectionOutput = async (
  wallet: SmrWallet,
  indexer: IndexerPluginClient,
  collectionId: string,
) => {
  try {
    const collectionOutputId = (await indexer.nft(collectionId)).items[0];
    return (await wallet.client.output(collectionOutputId)).output as INftOutput;
  } catch {
    throw invalidArgument(WenError.invalid_collection_id);
  }
};
