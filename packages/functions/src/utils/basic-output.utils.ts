import {
  AddressUnlockCondition,
  BasicOutput,
  BasicOutputBuilderParams,
  CommonOutput,
  ExpirationUnlockCondition,
  Feature,
  FeatureType,
  MetadataFeature,
  StorageDepositReturnUnlockCondition,
  TagFeature,
  TimelockUnlockCondition,
  UnlockCondition,
  UnlockConditionType,
  Utils,
  bigIntToHex,
  hexToUtf8,
  utf8ToHex,
} from '@iota/sdk';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { cloneDeep, isEmpty } from 'lodash';
import { Wallet, WalletParams } from '../services/wallet/wallet';
import { intToU32 } from './common.utils';

export const hasNoTimeLock = (output: BasicOutput) => {
  const locks = output.unlockConditions.filter(
    (u) => u.type === UnlockConditionType.Timelock,
  ) as TimelockUnlockCondition[];
  return locks.reduce((acc, act) => acc && dayjs().isAfter(dayjs.unix(act.unixTime)), true);
};

export const hasNativeToken = (output: BasicOutput, token: string) =>
  !isEmpty(output.nativeTokens?.filter((n) => n.id === token));

export const hasNoReturnCondition = (output: BasicOutput) =>
  output.unlockConditions.find((u) => u.type === UnlockConditionType.StorageDepositReturn) ===
  undefined;

export const nativeTokenCount = (output: BasicOutput, token: string) =>
  output.nativeTokens?.reduce(
    (acc, act) => (act.id === token ? acc + Number(act.amount) : acc),
    0,
  ) || 0;

export const nativeTokenCountTotal = (outputs: BasicOutput[], token: string) =>
  outputs.reduce((acc, act) => acc + nativeTokenCount(act, token), 0) || 0;

export const subtractHex = (a: string, b: string) => bigIntToHex(BigInt(a) - BigInt(b));

export const mergeOutputs = (outputs: BasicOutput[]) => {
  const addressUnlock = outputs[0].unlockConditions.find(
    (u) => u.type === UnlockConditionType.Address,
  )!;
  const merged: BasicOutputBuilderParams = {
    amount: BigInt(0),
    unlockConditions: [addressUnlock],
  };
  for (const output of outputs) {
    const nativeTokens = merged.nativeTokens || [];
    for (const nativeToken of output.nativeTokens || []) {
      const index = nativeTokens.findIndex((n) => n.id === nativeToken.id);
      if (index === -1) {
        nativeTokens.push(nativeToken);
      } else {
        nativeTokens[index].amount =
          BigInt(nativeTokens[index].amount) + BigInt(nativeToken.amount);
      }
    }
    merged.amount = BigInt(output.amount) + BigInt(merged.amount!);
    merged.nativeTokens = nativeTokens;
  }
  return merged;
};

export const packBasicOutput = async (
  wallet: Wallet,
  toBech32: string,
  amount: number,
  {
    storageDepositReturnAddress,
    vestingAt,
    expiration,
    nativeTokens,
    customMetadata,
    tag,
  }: WalletParams,
) => {
  const targetAddress = Utils.parseBech32Address(toBech32);
  const unlockConditions: UnlockCondition[] = [new AddressUnlockCondition(targetAddress)];
  if (storageDepositReturnAddress) {
    const returnAddress = Utils.parseBech32Address(storageDepositReturnAddress);
    unlockConditions.push(new StorageDepositReturnUnlockCondition(returnAddress, BigInt(10)));
  }
  if (vestingAt) {
    unlockConditions.push(new TimelockUnlockCondition(intToU32(dayjs(vestingAt.toDate()).unix())));
  }
  if (expiration) {
    unlockConditions.push(
      new ExpirationUnlockCondition(
        Utils.parseBech32Address(expiration.returnAddressBech32),
        dayjs(expiration.expiresAt.toDate()).unix(),
      ),
    );
  }
  const params: BasicOutputBuilderParams = {
    nativeTokens: nativeTokens?.map((nt) => ({
      id: nt.id,
      amount: BigInt(nt.amount),
    })),
    unlockConditions,
  };

  if (!isEmpty(customMetadata)) {
    const data = utf8ToHex(JSON.stringify(customMetadata));
    const metadataFeture = new MetadataFeature(data);
    params.features = (params.features || []) as Feature[];
    params.features.push(metadataFeture);
  }

  if (tag) {
    const tagFeature = new TagFeature(tag);
    params.features = (params.features || []) as Feature[];
    params.features.push(tagFeature);
  }

  const output = await wallet.client.buildBasicOutput(params);
  const rent = (await wallet.client.getInfo()).nodeInfo.protocol.rentStructure;
  const storageDeposit = Utils.computeStorageDeposit(output, rent);
  params.amount = bigInt.max(bigInt(amount), storageDeposit).toString();

  if (storageDepositReturnAddress) {
    const returnAddress = Utils.parseBech32Address(storageDepositReturnAddress);
    params.unlockConditions = params.unlockConditions.map((u) =>
      u.type === UnlockConditionType.StorageDepositReturn
        ? new StorageDepositReturnUnlockCondition(returnAddress, storageDeposit)
        : u,
    );
  }
  return await wallet.client.buildBasicOutput(params);
};

export const subtractNativeTokens = async (
  wallet: Wallet,
  basicOutput: BasicOutput,
  amount: number,
  token: string,
) => {
  const params: BasicOutputBuilderParams = cloneDeep(basicOutput);
  params.amount = BigInt(0);
  const total = nativeTokenCount(basicOutput, token);
  if (total < amount) {
    throw new Error(`Not enough native tokens, ${token}, ${total}`);
  }
  params.nativeTokens = (params.nativeTokens || [])
    .map((n) => (n.id === token ? { ...n, amount: n.amount - BigInt(amount) } : n))
    .filter((n) => Number(n.amount) > 0);

  const output = await wallet.client.buildBasicOutput(params);
  const rent = (await wallet.client.getInfo()).nodeInfo.protocol.rentStructure;
  params.amount = Utils.computeStorageDeposit(output, rent);

  return params;
};

export const getOutputMetadata = (output: CommonOutput | undefined) => {
  try {
    const metadataFeature = <MetadataFeature | undefined>(
      output?.features?.find((f) => f.type === FeatureType.Metadata)
    );
    const decoded = hexToUtf8(metadataFeature?.data || '{}');
    const metadata = JSON.parse(decoded);
    return metadata || {};
  } catch (e) {
    return {};
  }
};
