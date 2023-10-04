import { Timestamp } from '@build-5/interfaces';
import {
  ADDRESS_UNLOCK_CONDITION_TYPE,
  BASIC_OUTPUT_TYPE,
  Bech32Helper,
  EXPIRATION_UNLOCK_CONDITION_TYPE,
  FeatureTypes,
  IBasicOutput,
  ICommonOutput,
  IMetadataFeature,
  INativeToken,
  INodeInfo,
  ITagFeature,
  ITimelockUnlockCondition,
  METADATA_FEATURE_TYPE,
  STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE,
  TAG_FEATURE_TYPE,
  TIMELOCK_UNLOCK_CONDITION_TYPE,
  TransactionHelper,
  UnlockConditionTypes,
} from '@iota/iota.js-next';
import { Converter, HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { cloneDeep, isEmpty } from 'lodash';
import { Expiration } from '../services/wallet/IotaWalletService';

export const hasNoTimeLock = (output: IBasicOutput) => {
  const locks = output.unlockConditions.filter(
    (u) => u.type === TIMELOCK_UNLOCK_CONDITION_TYPE,
  ) as ITimelockUnlockCondition[];
  return locks.reduce((acc, act) => acc && dayjs().isAfter(dayjs.unix(act.unixTime)), true);
};

export const hasNativeToken = (output: IBasicOutput, token: string) =>
  !isEmpty(output.nativeTokens?.filter((n) => n.id === token));

export const hasNoReturnCondition = (output: IBasicOutput) =>
  output.unlockConditions.find((u) => u.type === STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE) ===
  undefined;

export const nativeTokenCount = (output: IBasicOutput, token: string) =>
  output.nativeTokens?.reduce(
    (acc, act) => (act.id === token ? acc + Number(HexHelper.toBigInt256(act.amount)) : acc),
    0,
  ) || 0;

export const nativeTokenCountTotal = (outputs: IBasicOutput[], token: string) =>
  outputs.reduce((acc, act) => acc + nativeTokenCount(act, token), 0) || 0;

const addHex = (a: string, b: string) =>
  HexHelper.fromBigInt256(HexHelper.toBigInt256(a).add(HexHelper.toBigInt256(b)));
export const subtractHex = (a: string, b: string) =>
  HexHelper.fromBigInt256(HexHelper.toBigInt256(a).subtract(HexHelper.toBigInt256(b)));

export const mergeOutputs = (outputs: IBasicOutput[]) => {
  const addressUnlock = outputs[0].unlockConditions.find(
    (u) => u.type === ADDRESS_UNLOCK_CONDITION_TYPE,
  )!;
  const merged: IBasicOutput = {
    type: BASIC_OUTPUT_TYPE,
    amount: '0',
    unlockConditions: [addressUnlock],
  };
  for (const output of outputs) {
    const nativeTokens = merged.nativeTokens || [];
    for (const nativeToken of output.nativeTokens || []) {
      const index = nativeTokens.findIndex((n) => n.id === nativeToken.id);
      if (index === -1) {
        nativeTokens.push(nativeToken);
      } else {
        nativeTokens[index].amount = addHex(nativeTokens[index].amount, nativeToken.amount);
      }
    }
    merged.amount = (Number(output.amount) + Number(merged.amount)).toString();
    merged.nativeTokens = nativeTokens;
  }
  return merged;
};

export const packBasicOutput = (
  toBech32: string,
  amount: number,
  nativeTokens: INativeToken[] | undefined,
  info: INodeInfo,
  retrunAddressBech32?: string,
  vestingAt?: Timestamp | null,
  expiration?: Expiration,
  metadata?: Record<string, unknown>,
  tag?: string,
) => {
  const targetAddress = Bech32Helper.addressFromBech32(toBech32, info.protocol.bech32Hrp);
  const unlockConditions: UnlockConditionTypes[] = [
    { type: ADDRESS_UNLOCK_CONDITION_TYPE, address: targetAddress },
  ];
  if (retrunAddressBech32) {
    const returnAddress = Bech32Helper.addressFromBech32(
      retrunAddressBech32,
      info.protocol.bech32Hrp,
    );
    unlockConditions.push({
      type: STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE,
      amount: '0',
      returnAddress,
    });
  }
  if (vestingAt) {
    unlockConditions.push({
      type: TIMELOCK_UNLOCK_CONDITION_TYPE,
      unixTime: dayjs(vestingAt.toDate()).unix(),
    });
  }
  if (expiration) {
    unlockConditions.push({
      type: EXPIRATION_UNLOCK_CONDITION_TYPE,
      unixTime: dayjs(expiration.expiresAt.toDate()).unix(),
      returnAddress: Bech32Helper.addressFromBech32(
        expiration.returnAddressBech32,
        info.protocol.bech32Hrp,
      ),
    });
  }
  const output: IBasicOutput = {
    type: BASIC_OUTPUT_TYPE,
    amount: '0',
    nativeTokens: nativeTokens?.map((nt) => ({
      id: nt.id,
      amount: HexHelper.fromBigInt256(bigInt(Number(nt.amount))),
    })),
    unlockConditions,
  };

  if (!isEmpty(metadata)) {
    const data = Converter.utf8ToHex(JSON.stringify(metadata), true);
    const metadataFeture = { type: METADATA_FEATURE_TYPE, data } as IMetadataFeature;
    output.features = (output.features || []) as FeatureTypes[];
    output.features.push(metadataFeture);
  }

  if (tag) {
    const tagFeature = { type: TAG_FEATURE_TYPE, tag } as ITagFeature;
    output.features = (output.features || []) as FeatureTypes[];
    output.features.push(tagFeature);
  }

  const storageDeposit = TransactionHelper.getStorageDeposit(output, info.protocol.rentStructure!);
  output.amount = bigInt.max(bigInt(amount), storageDeposit).toString();

  if (retrunAddressBech32) {
    output.unlockConditions = output.unlockConditions.map((u) =>
      u.type === STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE
        ? { ...u, amount: storageDeposit.toString() }
        : u,
    );
  }
  return output;
};

export const subtractNativeTokens = (
  output: IBasicOutput,
  amount: number,
  token: string,
  info: INodeInfo,
) => {
  const result = cloneDeep(output);
  result.amount = '0';
  const total = nativeTokenCount(output, token);
  if (total < amount) {
    throw new Error(`Not enough native tokens, ${token}, ${total}`);
  }
  result.nativeTokens = (result.nativeTokens || [])
    .map((n) =>
      n.id === token
        ? { ...n, amount: subtractHex(n.amount, HexHelper.fromBigInt256(bigInt(amount))) }
        : n,
    )
    .filter((n) => Number(n.amount) > 0);
  result.amount = TransactionHelper.getStorageDeposit(
    output,
    info.protocol.rentStructure,
  ).toString();
  return result;
};

export const getOutputMetadata = (output: ICommonOutput | undefined) => {
  try {
    const metadataFeature = <IMetadataFeature | undefined>(
      output?.features?.find((f) => f.type === METADATA_FEATURE_TYPE)
    );
    const decoded = Converter.hexToUtf8(metadataFeature?.data || '{}');
    const metadata = JSON.parse(decoded);
    return metadata || {};
  } catch (e) {
    return {};
  }
};
