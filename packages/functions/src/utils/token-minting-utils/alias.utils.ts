import {
  AliasOutput,
  AliasOutputBuilderParams,
  Ed25519Address,
  GovernorAddressUnlockCondition,
  IssuerFeature,
  StateControllerAddressUnlockCondition,
  UnlockConditionType,
  Utils,
} from '@iota/sdk';
import { Wallet } from '../../services/wallet/wallet';
import { AddressDetails } from '../../services/wallet/wallet.service';
import { Bech32AddressHelper } from '../bech32-address.helper';

export const EMPTY_ALIAS_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

export const createAliasOutput = async (wallet: Wallet, sourceAddress: AddressDetails) => {
  const address = new Ed25519Address(sourceAddress.hex);
  const params: AliasOutputBuilderParams = {
    aliasId: EMPTY_ALIAS_ID,
    stateIndex: 0,
    foundryCounter: 0,
    immutableFeatures: [new IssuerFeature(address)],
    unlockConditions: [
      new StateControllerAddressUnlockCondition(address),
      new GovernorAddressUnlockCondition(address),
    ],
  };
  const output = await wallet.client.buildAliasOutput(params);
  const info = (await wallet.client.getInfo()).nodeInfo;
  params.amount = Utils.computeStorageDeposit(output, info.protocol.rentStructure);
  return await wallet.client.buildAliasOutput(params);
};

export const isAliasGovernor = (alias: AliasOutput, address: string, hrp: string) => {
  const governors =
    alias.unlockConditions?.filter((uc) => uc.type === UnlockConditionType.GovernorAddress) || [];

  for (const governor of governors) {
    const governorBech32 = Bech32AddressHelper.addressToBech32(
      (governor as GovernorAddressUnlockCondition).address,
      hrp,
    );
    if (governorBech32 === address) {
      return true;
    }
  }
  return false;
};
