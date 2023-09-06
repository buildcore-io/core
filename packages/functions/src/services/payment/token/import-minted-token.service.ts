import { build5Db, build5Storage } from '@build-5/database';
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
  IAliasAddress,
  IAliasOutput,
  IFoundryOutput,
  IImmutableAliasUnlockCondition,
  IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE,
  IMetadataFeature,
  IndexerPluginClient,
  METADATA_FEATURE_TYPE,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import Joi from 'joi';
import { get, isEmpty } from 'lodash';
import { getBucket } from '../../../utils/config.utils';
import { migrateUriToSotrage, uriToUrl } from '../../../utils/media.utils';
import { isAliasGovernor } from '../../../utils/token-minting-utils/alias.utils';
import { SmrWallet } from '../../wallet/SmrWalletService';
import { WalletService } from '../../wallet/wallet';
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

      const wallet = (await WalletService.newWallet(order.network)) as SmrWallet;
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
      const totalSupply = Number(foundry.tokenScheme.maximumSupply);
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
          meltedTokens: Number(foundry.tokenScheme.meltedTokens),
          circulatingSupply: totalSupply - Number(foundry.tokenScheme.meltedTokens),
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
    wallet: SmrWallet,
    order: Transaction,
    match: TransactionMatch,
  ) => {
    const indexer = new IndexerPluginClient(wallet.client);
    const foundry = await indexer.foundry(order.payload.tokenId!);
    const foundryOutput = <IFoundryOutput>(await wallet.client.output(foundry.items[0])).output;

    const unlockCondition = <IImmutableAliasUnlockCondition>(
      foundryOutput.unlockConditions.find((uc) => uc.type === IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE)
    );
    const aliasId = (unlockCondition.address as IAliasAddress).aliasId;

    const alias = await indexer.alias(aliasId);
    const aliasOutput = <IAliasOutput>(await wallet.client.output(alias.items[0])).output;

    if (!isAliasGovernor(aliasOutput, match.from.address, wallet.info.protocol.bech32Hrp)) {
      throw WenError.not_alias_governor;
    }

    return { foundry: foundryOutput, alias: aliasOutput };
  };

  private getTokenMetadata = (foundry: IFoundryOutput) => {
    const metadataFeature = <IMetadataFeature | undefined>(
      foundry?.immutableFeatures?.find((f) => f.type === METADATA_FEATURE_TYPE)
    );
    const decoded = Converter.hexToUtf8(metadataFeature?.data || '{}');
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
