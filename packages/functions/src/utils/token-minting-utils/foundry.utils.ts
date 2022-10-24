import * as lib from '@iota/iota.js-next';
import { IFoundryOutput, INodeInfo, TransactionHelper } from '@iota/iota.js-next';
import { Converter, HexHelper } from '@iota/util.js-next';
import { KEY_NAME_TANGLE, Token } from '@soon/interfaces';
import bigInt from 'big-integer';
import admin from '../../admin.config';
import { packBasicOutput } from '../basic-output.utils';
import { getMediaMetadata } from '../storage.utils';

export const createFoundryOutput = (
  maximumSupply: number,
  alias: lib.IAliasOutput,
  metadata: string,
  info: INodeInfo,
): lib.IFoundryOutput => {
  const output: IFoundryOutput = {
    type: lib.FOUNDRY_OUTPUT_TYPE,
    amount: '0',
    serialNumber: alias.foundryCounter,
    tokenScheme: {
      type: lib.SIMPLE_TOKEN_SCHEME_TYPE,
      mintedTokens: HexHelper.fromBigInt256(bigInt(maximumSupply)),
      meltedTokens: HexHelper.fromBigInt256(bigInt(0)),
      maximumSupply: HexHelper.fromBigInt256(bigInt(maximumSupply)),
    },
    unlockConditions: [
      {
        type: lib.IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE,
        address: { type: lib.ALIAS_ADDRESS_TYPE, aliasId: alias.aliasId },
      },
    ],
    immutableFeatures: [
      { type: lib.METADATA_FEATURE_TYPE, data: Converter.utf8ToHex(metadata, true) },
    ],
  };
  output.amount = TransactionHelper.getStorageDeposit(
    output,
    info.protocol.rentStructure,
  ).toString();
  return output;
};

export const getVaultAndGuardianOutput = async (
  tokenId: string,
  totalSupply: number,
  totalDistributed: number,
  vaultAddress: string,
  guardianAddress: string,
  info: INodeInfo,
) => {
  const tokensToGuardian = totalSupply - totalDistributed;
  const guardianAmount = HexHelper.fromBigInt256(bigInt(tokensToGuardian));
  const guardianOutput =
    tokensToGuardian > 0
      ? packBasicOutput(guardianAddress, 0, [{ amount: guardianAmount, id: tokenId }], info)
      : undefined;

  const vaultAmount = HexHelper.fromBigInt256(bigInt(totalDistributed));
  const vaultOutput = totalDistributed
    ? packBasicOutput(vaultAddress, 0, [{ amount: vaultAmount, id: tokenId }], info)
    : undefined;

  return { vaultOutput, guardianOutput };
};

export const tokenToFoundryMetadata = async (storage: admin.storage.Storage, token: Token) => {
  const mediaMetadata = await getMediaMetadata(storage, token.icon || '');
  return {
    standard: 'IRC30',
    type: mediaMetadata.contentType || 'application/octet-stream',
    name: token.name,
    uri: token.ipfsMedia ? 'ipfs://' + token.ipfsMedia : '',
    issuerName: KEY_NAME_TANGLE,
    soonaverseId: token.uid,
    symbol: token.symbol.toLowerCase(),
    decimals: 6,
  };
};
