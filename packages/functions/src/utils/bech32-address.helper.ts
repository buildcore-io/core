import { NetworkAddress } from '@build-5/interfaces';
import {
  ADDRESS_UNLOCK_CONDITION_TYPE,
  ALIAS_ADDRESS_TYPE,
  ALIAS_OUTPUT_TYPE,
  AddressTypes,
  BASIC_OUTPUT_TYPE,
  Bech32Helper,
  ED25519_ADDRESS_TYPE,
  FOUNDRY_OUTPUT_TYPE,
  GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE,
  IAddressUnlockCondition,
  IGovernorAddressUnlockCondition,
  IImmutableAliasUnlockCondition,
  IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE,
  IStateControllerAddressUnlockCondition,
  NFT_ADDRESS_TYPE,
  NFT_OUTPUT_TYPE,
  STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE,
  UnlockConditionTypes,
} from '@iota/iota.js-next';
import { Converter, HexHelper } from '@iota/util.js-next';

export class Bech32AddressHelper {
  public static addressFromAddressUnlockCondition = (
    unlockConditions: UnlockConditionTypes[],
    hrp: string,
    outputType: number,
  ): string => {
    const unlockCondition = Bech32AddressHelper.getUnlockConditionForType(
      outputType,
      unlockConditions,
    );
    if (unlockCondition?.address) {
      return Bech32AddressHelper.buildAddress(hrp, unlockCondition?.address);
    }
    return '';
  };

  public static buildAddress(
    hrp: string,
    address: NetworkAddress | AddressTypes,
    typeHint?: number,
  ): string {
    return typeof address === 'string'
      ? this.buildAddressFromString(hrp, address, typeHint)
      : this.buildAddressFromTypes(hrp, address);
  }

  private static getUnlockConditionForType = (
    outputType: number,
    unlockConditions: UnlockConditionTypes[],
  ) => {
    if (outputType === BASIC_OUTPUT_TYPE || outputType === NFT_OUTPUT_TYPE) {
      return unlockConditions.find(
        (c) => c.type === ADDRESS_UNLOCK_CONDITION_TYPE,
      ) as IAddressUnlockCondition;
    }
    if (outputType === ALIAS_OUTPUT_TYPE) {
      const condition = unlockConditions.find(
        (c) => c.type === STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE,
      ) as IStateControllerAddressUnlockCondition;
      return (
        condition ||
        (unlockConditions.find(
          (c) => c.type === GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE,
        ) as IGovernorAddressUnlockCondition)
      );
    }
    if (outputType === FOUNDRY_OUTPUT_TYPE) {
      return unlockConditions.find(
        (c) => c.type === IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE,
      ) as IImmutableAliasUnlockCondition;
    }
    return;
  };

  private static buildAddressFromString(
    hrp: string,
    address: NetworkAddress,
    typeHint?: number,
  ): string {
    if (Bech32Helper.matches(address, hrp)) {
      try {
        const result = Bech32Helper.fromBech32(address, hrp);
        if (result) {
          return address;
        }
        // eslint-disable-next-line no-empty
      } catch {}
    }
    return Bech32Helper.toBech32(
      typeHint ?? ED25519_ADDRESS_TYPE,
      Converter.hexToBytes(address),
      hrp,
    );
  }

  private static buildAddressFromTypes(hrp: string, address: AddressTypes): string {
    const getHex = () => {
      switch (address.type) {
        case ED25519_ADDRESS_TYPE:
          return HexHelper.stripPrefix(address.pubKeyHash);
        case ALIAS_ADDRESS_TYPE:
          return HexHelper.stripPrefix(address.aliasId);
        case NFT_ADDRESS_TYPE:
          return HexHelper.stripPrefix(address.nftId);
      }
    };
    return this.buildAddressFromString(hrp, getHex(), address.type);
  }
}
