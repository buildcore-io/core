import { NetworkAddress } from '@build-5/interfaces';
import * as lib from '@iota/iota.js-next';
import {
  ALIAS_ADDRESS_TYPE,
  ALIAS_OUTPUT_TYPE,
  Bech32Helper,
  GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE,
  IAliasOutput,
  INodeInfo,
  TransactionHelper,
} from '@iota/iota.js-next';
import { Converter, HexHelper } from '@iota/util.js-next';
import { AddressDetails } from '../../services/wallet/wallet';
import { Bech32AddressHelper } from '../bech32-address.helper';

export const EMPTY_ALIAS_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

export const createAliasOutput = (
  sourceAddress: AddressDetails,
  info: INodeInfo,
): lib.IAliasOutput => {
  const address: lib.AddressTypes = {
    type: lib.ED25519_ADDRESS_TYPE,
    pubKeyHash: sourceAddress.hex,
  };
  const output: IAliasOutput = {
    type: lib.ALIAS_OUTPUT_TYPE,
    amount: '0',
    aliasId: EMPTY_ALIAS_ID,
    stateIndex: 0,
    foundryCounter: 0,
    immutableFeatures: [{ type: lib.ISSUER_FEATURE_TYPE, address }],
    unlockConditions: [
      { type: lib.STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE, address },
      { type: lib.GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE, address },
    ],
  };
  output.amount = TransactionHelper.getStorageDeposit(
    output,
    info.protocol.rentStructure,
  ).toString();
  return output;
};

export const getAliasBech32Address = (aliasId: string, info: INodeInfo) =>
  Bech32Helper.toBech32(
    ALIAS_ADDRESS_TYPE,
    Converter.hexToBytes(HexHelper.stripPrefix(aliasId)),
    info.protocol.bech32Hrp,
  );

export const isAliasGovernor = (alias: IAliasOutput, address: NetworkAddress, hrp: string) => {
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
