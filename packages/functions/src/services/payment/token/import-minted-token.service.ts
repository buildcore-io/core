import {
  ALIAS_OUTPUT_TYPE,
  GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE,
  IAliasAddress,
  IAliasOutput,
  IFoundryOutput,
  IImmutableAliasUnlockCondition,
  IMetadataFeature,
  IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE,
  IndexerPluginClient,
  METADATA_FEATURE_TYPE,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import {
  Access,
  COL,
  MediaStatus,
  Token,
  TokenStatus,
  Transaction,
  TransactionCreditType,
  WenError,
} from '@soonaverse/interfaces';
import Joi from 'joi';
import { get } from 'lodash';
import admin from '../../../admin.config';
import { Bech32AddressHelper } from '../../../utils/bech32-address.helper';
import { getBucket } from '../../../utils/config.utils';
import { migrateUriToSotrage, uriToUrl } from '../../../utils/media.utils';
import { SmrWallet } from '../../wallet/SmrWalletService';
import { WalletService } from '../../wallet/wallet';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class ImportMintedTokenService {
  constructor(readonly transactionService: TransactionService) {}

  public handleMintedTokenImport = async (order: Transaction, match: TransactionMatch) => {
    let error: { [key: string]: unknown } = {};
    try {
      const tokenId = order.payload.tokenId;
      const existingTokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${tokenId}`);
      const existingToken = <Token | undefined>(
        (await this.transactionService.transaction.get(existingTokenDocRef)).data()
      );
      if (existingToken) {
        throw WenError.token_does_not_exist;
      }

      const wallet = (await WalletService.newWallet(order.network)) as SmrWallet;
      const { foundry, alias } = await this.getFoundryOutput(wallet, order, match);
      const metadata = this.getTokenMetadata(foundry);

      const icon = await migrateUriToSotrage(
        COL.TOKEN,
        order.member!,
        tokenId,
        uriToUrl(metadata.uri),
        admin.storage().bucket(getBucket()),
      );

      const vaultAddress = await wallet.getNewIotaAddressDetails();
      const totalSupply = Number(foundry.tokenScheme.maximumSupply);
      const token: Token = {
        createdBy: order.member,
        uid: tokenId,
        name: metadata.name,
        description: metadata.description || '',
        symbol: (metadata.symbol as string).toUpperCase(),
        space: order.space || '',
        totalSupply,
        allocations: [],
        approved: true,
        rejected: false,
        public: false,
        links: [],
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
        mediaStatus: MediaStatus.PENDING_UPLOAD,
        tradingDisabled: true,
        pricePerToken: 0,
      };
      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
      this.transactionService.updates.push({ ref: tokenDocRef, data: token, action: 'set' });
    } catch (err) {
      error = {
        status: 'error',
        code: get(err, 'code', 1000),
        message: get(err, 'key', 'none'),
      };
    } finally {
      const payment = await this.transactionService.createPayment(
        order,
        match,
        error !== undefined,
      );
      await this.transactionService.createCredit(
        TransactionCreditType.IMPORT_TOKEN,
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
    const foundry = await indexer.foundry(order.payload.tokenId);
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
    const result = tokenIrc27Schema.validate(metadata, { allowUnknown: true });
    if (result.error) {
      throw WenError.token_not_irc27_compilant;
    }
    return metadata;
  };
}

const isAliasGovernor = (alias: IAliasOutput, address: string, hrp: string) => {
  const governors =
    alias.unlockConditions?.filter((uc) => uc.type === GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE) ||
    [];

  for (const governor of governors) {
    const governorBech32 = Bech32AddressHelper.addressFromAddressUnlockCondition(
      [governor],
      hrp,
      ALIAS_OUTPUT_TYPE,
    );
    if (governorBech32 === address) {
      return true;
    }
  }
  return false;
};

const tokenIrc27Schema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  uri: Joi.string().required(),
  symbol: Joi.string().required(),
});