import {
  ALIAS_ADDRESS_TYPE,
  AddressTypes,
  ED25519_ADDRESS_TYPE,
  INftOutput,
  IndexerPluginClient,
  NFT_ADDRESS_TYPE,
} from '@iota/iota.js-next';
import {
  COL,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  NftStatus,
  SUB_COL,
  Space,
  SpaceGuardian,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionUnlockType,
  TransactionValidationType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import { soonDb } from '../../../../firebase/firestore/soondb';
import { packBasicOutput } from '../../../../utils/basic-output.utils';
import {
  EMPTY_NFT_ID,
  createNftOutput,
  getNftByMintingId,
} from '../../../../utils/collection-minting-utils/nft.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { getAliasId } from '../../../../utils/nft.output.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getSpaceByAliasId } from '../../../../utils/space.utils';
import {
  EMPTY_ALIAS_ID,
  createAliasOutput,
} from '../../../../utils/token-minting-utils/alias.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { CommonJoi } from '../../../joi/common';
import { SmrWallet } from '../../../wallet/SmrWalletService';
import { WalletService } from '../../../wallet/wallet';
import { TransactionService } from '../../transaction-service';

const schema = Joi.object({
  nftId: CommonJoi.uid(false),
  collectionId: Joi.when('nftId', {
    is: CommonJoi.uid(),
    then: CommonJoi.uid(),
    otherwise: CommonJoi.uid(false),
  }),
  aliasId: Joi.when('collectionId', {
    is: CommonJoi.uid(),
    then: CommonJoi.uid(),
    otherwise: CommonJoi.uid(false),
  }),
  metadata: Joi.object().required(),
});

export class MintMetadataNftService {
  constructor(readonly transactionService: TransactionService) {}

  public handleMetadataNftMintRequest = async (
    network: Network,
    owner: string,
    request: Record<string, unknown>,
    amountReceived: number,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
  ) => {
    delete request.requestType;
    await assertValidationAsync(schema, request);

    const wallet = (await WalletService.newWallet(network)) as SmrWallet;
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const aliasId = (request.aliasId as string) || EMPTY_ALIAS_ID;
    const collectionId = (request.collectionId as string) || EMPTY_NFT_ID;

    const space = await getSpace(owner, aliasId);
    const aliasOutputAmount = await getAliasOutputAmount(owner, space, wallet);
    const collectionOutputAmount = await getCollectionOutputAmount(aliasId, request, wallet);
    const nftOutputAmount = await getNftOutputAmount(collectionId, request, wallet);

    const amount = aliasOutputAmount + collectionOutputAmount + nftOutputAmount;

    const remainingAmount = amountReceived - amount;
    const remainderOutput = packBasicOutput(
      targetAddress.bech32,
      remainingAmount,
      undefined,
      wallet.info,
    );

    if (remainingAmount && remainingAmount !== Number(remainderOutput.amount)) {
      return {
        status: 'error',
        code: WenError.invalid_base_token_amount.code,
        message: WenError.invalid_base_token_amount.key,
        amount: amount,
      };
    }

    if (aliasId === EMPTY_ALIAS_ID) {
      const spaceDocRef = soonDb().doc(`${COL.SPACE}/${space.uid}`);
      this.transactionService.push({ ref: spaceDocRef, data: space, action: 'set' });

      const guardian = { uid: owner, parentId: space.uid, parentCol: COL.SPACE };
      const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner);
      this.transactionService.push({ ref: guardianDocRef, data: guardian, action: 'set' });

      const memberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner);
      this.transactionService.push({ ref: memberDocRef, data: guardian, action: 'set' });
    }

    const order = <Transaction>{
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: space.uid,
      network,
      payload: {
        type: TransactionOrderType.MINT_METADATA_NFT,
        amount: amountReceived,
        targetAddress: targetAddress.bech32,
        validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
        expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        reconciled: false,
        void: false,
        aliasId: request.aliasId || '',
        aliasOutputAmount,
        collectionId: request.collectionId || '',
        collectionOutputAmount,
        nftId: request.nftId || '',
        nftOutputAmount,
        metadata: request.metadata,
      },
    };
    const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
    this.transactionService.push({ ref: orderDocRef, data: order, action: 'set' });

    this.transactionService.createUnlockTransaction(
      order,
      tran,
      tranEntry,
      TransactionUnlockType.TANGLE_TRANSFER,
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
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${space.uid}`);
  const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner);
  const guardian = await guardianDocRef.get<SpaceGuardian>();

  if (!guardian) {
    throw invalidArgument(WenError.not_alias_governor);
  }

  return 0;
};

const getCollectionOutputAmount = async (
  aliasId: string,
  request: Record<string, unknown>,
  wallet: SmrWallet,
) => {
  if (!request.collectionId) {
    const issuerAddress: AddressTypes = { type: ALIAS_ADDRESS_TYPE, aliasId };
    const collectionOutput = createNftOutput(issuerAddress, issuerAddress, '', wallet.info);
    return Number(collectionOutput.amount);
  }

  const indexer = new IndexerPluginClient(wallet.client);
  const result = await indexer.nft(request.collectionId as string);
  const collectionOutput = (await wallet.client.output(result.items[0])).output as INftOutput;
  const collectionAliasId = getAliasId(collectionOutput);
  if (collectionAliasId !== aliasId) {
    throw invalidArgument(WenError.not_alias_governor);
  }
  return 0;
};

const createMetadataNftOutput = async (
  wallet: SmrWallet,
  collectionId: string,
  metadata: Record<string, unknown>,
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

const getSpace = async (owner: string, aliasId: string) => {
  if (aliasId === EMPTY_ALIAS_ID) {
    return {
      uid: getRandomEthAddress(),
      name: `Space of alias: ${aliasId}`,
      open: false,
      createdBy: owner,
      totalGuardians: 1,
      totalMembers: 1,
      totalPendingMembers: 0,
      guardians: {},
      members: {},
    } as Space;
  }

  const space = await getSpaceByAliasId(aliasId);
  if (!space || !space.alias?.address) {
    throw invalidArgument(WenError.alias_not_deposited);
  }
  return space;
};

const getNftOutputAmount = async (
  collectionId: string,
  request: Record<string, unknown>,
  wallet: SmrWallet,
) => {
  const nftId = request.nftId as string | undefined;
  if (nftId) {
    const nft = await getNftByMintingId(nftId);
    if (!nft || nft.status !== NftStatus.MINTED) {
      throw invalidArgument(WenError.nft_not_deposited);
    }
  }
  const nftOutput = await createMetadataNftOutput(
    wallet,
    collectionId,
    request.metadata as Record<string, unknown>,
  );
  return Number(nftOutput.amount);
};
