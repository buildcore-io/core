import { KEY_NAME_TANGLE, Token } from '@build-5/interfaces';
import {
  AliasAddress,
  AliasOutput,
  FoundryOutputBuilderParams,
  ImmutableAliasAddressUnlockCondition,
  MetadataFeature,
  SimpleTokenScheme,
  Utils,
  utf8ToHex,
} from '@iota/sdk';
import { head } from 'lodash';
import { Wallet } from '../../services/wallet/wallet';
import { packBasicOutput } from '../basic-output.utils';
import { PLACEHOLDER_CID } from '../car.utils';
import { getContentType } from '../storage.utils';

export const createFoundryOutput = async (
  wallet: Wallet,
  maximumSupply: number,
  alias: AliasOutput,
  metadata: string,
) => {
  const params: FoundryOutputBuilderParams = {
    serialNumber: alias.foundryCounter || 1,
    tokenScheme: new SimpleTokenScheme(BigInt(maximumSupply), BigInt(0), BigInt(maximumSupply)),
    unlockConditions: [new ImmutableAliasAddressUnlockCondition(new AliasAddress(alias.aliasId))],
    immutableFeatures: [new MetadataFeature(utf8ToHex(metadata))],
  };
  const output = await wallet.client.buildFoundryOutput(params);
  const rent = (await wallet.client.getInfo()).nodeInfo.protocol.rentStructure;
  params.amount = Utils.computeStorageDeposit(output, rent);
  return await wallet.client.buildFoundryOutput(params);
};

export const getVaultAndGuardianOutput = async (
  wallet: Wallet,
  tokenId: string,
  totalSupply: number,
  totalDistributed: number,
  vaultAddress: string,
  guardianAddress: string,
) => {
  const tokensToGuardian = totalSupply - totalDistributed;
  const guardianOutput =
    tokensToGuardian > 0
      ? await packBasicOutput(wallet, guardianAddress, 0, {
          nativeTokens: [{ amount: BigInt(tokensToGuardian), id: tokenId }],
        })
      : undefined;

  const vaultOutput = totalDistributed
    ? await packBasicOutput(wallet, vaultAddress, 0, {
        nativeTokens: [{ amount: BigInt(totalDistributed), id: tokenId }],
      })
    : undefined;

  return { vaultOutput, guardianOutput };
};

export const tokenToFoundryMetadata = async (token: Token) => {
  return {
    standard: 'IRC30',
    type: await getContentType(token.icon),
    name: token.name,
    description: token.description || '',
    url: head(token.links) || '',
    logoUrl: 'ipfs://' + (token.ipfsMedia || PLACEHOLDER_CID),
    issuerName: KEY_NAME_TANGLE,
    build5Id: token.uid,
    symbol: token.symbol.toUpperCase(),
    decimals: token.decimals,
  };
};
