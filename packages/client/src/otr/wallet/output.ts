import {
  AddressUnlockCondition,
  BasicOutputBuilderParams,
  Client,
  MetadataFeature,
  TagFeature,
  Utils,
  utf8ToHex,
} from '@iota/sdk';
import bigInt from 'big-integer';
import { TAG, WalletPrams } from './common';

export const packBasicOutput = async (
  client: Client,
  { targetAddress, nativeTokens, amount, metadata }: WalletPrams,
) => {
  const params: BasicOutputBuilderParams = {
    unlockConditions: [new AddressUnlockCondition(Utils.parseBech32Address(targetAddress))],
    features: [
      new TagFeature(utf8ToHex(TAG)),
      new MetadataFeature(utf8ToHex(JSON.stringify(metadata))),
    ],
  };

  if (nativeTokens) {
    params.nativeTokens = [nativeTokens];
  }

  const output = await client.buildBasicOutput(params);
  const rent = (await client.getInfo()).nodeInfo.protocol.rentStructure;
  const storageDeposit = Utils.computeStorageDeposit(output, rent);
  params.amount = bigInt.max(bigInt(amount || 0), storageDeposit).toString();

  return await client.buildBasicOutput(params);
};
