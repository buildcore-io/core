import {
  Access,
  COL,
  MediaStatus,
  Token,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  WenError,
} from '@build-5/interfaces';
import {
  AliasAddress,
  AliasOutput,
  FeatureType,
  FoundryOutput,
  ImmutableAliasAddressUnlockCondition,
  MetadataFeature,
  SimpleTokenScheme,
  UnlockConditionType,
  hexToUtf8,
} from '@iota/sdk';
import Joi from 'joi';
import { get, isEmpty } from 'lodash';
import { build5Db } from '../../../firebase/firestore/build5Db';
import { build5Storage } from '../../../firebase/storage/build5Storage';
import { getBucket } from '../../../utils/config.utils';
import { migrateUriToSotrage, uriToUrl } from '../../../utils/media.utils';
import { isAliasGovernor } from '../../../utils/token-minting-utils/alias.utils';
import { Wallet } from '../../wallet/wallet';
import { WalletService } from '../../wallet/wallet.service';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class ImportMintedTokenService {
  constructor(readonly transactionService: TransactionService) {}

  public handleMintedTokenImport = async (order: Transaction, match: TransactionMatch) => {
    let error: { [key: string]: unknown } = {};
    try {
      const tokenId = order.payload.tokenId!;
      const existingTokenDocRef = build5Db().doc(`${COL.TOKEN}/${tokenId}`);
      const existingToken = await this.transactionService.get<Token>(existingTokenDocRef);

      if (existingToken) {
        throw WenError.token_does_not_exist;
      }

      const wallet = await WalletService.newWallet(order.network);
      const { foundry, alias } = await this.getFoundryOutput(wallet, order, match);
      const metadata = this.getTokenMetadata(foundry);

      const icon = metadata.logoUrl
        ? await migrateUriToSotrage(
            COL.TOKEN,
            order.member!,
            tokenId,
            uriToUrl(metadata.logoUrl),
            build5Storage().bucket(getBucket()),
          )
        : '';

      const vaultAddress = await wallet.getNewIotaAddressDetails();
      const tokenScheme = foundry.tokenScheme as SimpleTokenScheme;
      const totalSupply = Number(tokenScheme.maximumSupply);
      const token: Token = {
        createdBy: order.member || '',
        uid: tokenId,
        name: metadata.name,
        title: metadata.name,
        description: metadata.description || '',
        shortDescriptionTitle: metadata.name,
        shortDescription: metadata.description || '',
        symbol: (metadata.symbol as string).toUpperCase(),
        space: order.space || '',
        totalSupply,
        allocations: [],
        approved: true,
        rejected: false,
        public: false,
        links: metadata.url ? [metadata.url] : [],
        icon,
        status: TokenStatus.MINTED,
        totalDeposit: 0,
        totalAirdropped: 0,
        termsAndConditions: '',
        access: Access.OPEN,
        mintingData: {
          aliasId: alias.aliasId,
          aliasStorageDeposit: Number(alias.amount),
          tokenId,
          foundryStorageDeposit: Number(foundry.amount),
          network: order.network,
          networkFormat: order.network,
          vaultAddress: vaultAddress.bech32,
          meltedTokens: Number(tokenScheme.meltedTokens),
          circulatingSupply: totalSupply - Number(tokenScheme.meltedTokens),
        },
        mediaStatus: icon ? MediaStatus.PENDING_UPLOAD : MediaStatus.UPLOADED,
        tradingDisabled: true,
        pricePerToken: 0,
        decimals: metadata.decimals,
      };
      const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
      this.transactionService.push({ ref: tokenDocRef, data: token, action: 'set' });
    } catch (err) {
      error = {
        status: 'error',
        code: get(err, 'code', 1000),
        message: get(err, 'key', 'none'),
      };
    } finally {
      const payment = await this.transactionService.createPayment(order, match, !isEmpty(error));
      await this.transactionService.createCredit(
        TransactionPayloadType.IMPORT_TOKEN,
        payment,
        match,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        error,
      );
      !error && this.transactionService.markAsReconciled(order, match.msgId);
    }
  };

  private getFoundryOutput = async (
    wallet: Wallet,
    order: Transaction,
    match: TransactionMatch,
  ) => {
    const foundry = await wallet.client.foundryOutputId(order.payload.tokenId!);
    const foundryOutput = <FoundryOutput>(await wallet.client.getOutput(foundry)).output;

    const unlockCondition = <ImmutableAliasAddressUnlockCondition>(
      foundryOutput.unlockConditions.find(
        (uc) => uc.type === UnlockConditionType.ImmutableAliasAddress,
      )
    );
    const aliasId = (unlockCondition.address as AliasAddress).aliasId;

    const alias = await wallet.client.aliasOutputId(aliasId);
    const aliasOutput = <AliasOutput>(await wallet.client.getOutput(alias)).output;

    if (!isAliasGovernor(aliasOutput, match.from, wallet.info.protocol.bech32Hrp)) {
      throw WenError.not_alias_governor;
    }

    return { foundry: foundryOutput, alias: aliasOutput };
  };

  private getTokenMetadata = (foundry: FoundryOutput) => {
    const metadataFeature = <MetadataFeature | undefined>(
      foundry?.immutableFeatures?.find((f) => f.type === FeatureType.Metadata)
    );
    const decoded = hexToUtf8(metadataFeature?.data || '{}');
    const metadata = JSON.parse(decoded) || {};
    const result = tokenIrc30Schema.validate(metadata, { allowUnknown: true });
    if (result.error) {
      throw WenError.token_not_irc30_compilant;
    }
    return metadata;
  };
}

const tokenIrc30Schema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  logoUrl: Joi.string().allow('').optional(),
  url: Joi.string().allow('').optional(),
  symbol: Joi.string().required(),
  decimals: Joi.number().integer().required(),
});
