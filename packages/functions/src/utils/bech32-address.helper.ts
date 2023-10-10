import {
  Address,
  AddressType,
  AddressUnlockCondition,
  AliasAddress,
  BasicOutput,
  Ed25519Address,
  GovernorAddressUnlockCondition,
  ImmutableAliasAddressUnlockCondition,
  NftAddress,
  OutputType,
  StateControllerAddressUnlockCondition,
  UnlockConditionType,
  Utils,
} from '@iota/sdk';

export class Bech32AddressHelper {
  public static bech32FromUnlockConditions = (output: BasicOutput, hrp: string): string => {
    const unlockCondition = Bech32AddressHelper.getUnlockCondition(output);
    if (unlockCondition?.address) {
      return Bech32AddressHelper.addressToBech32(unlockCondition?.address, hrp);
    }
    return '';
  };

  private static getUnlockCondition = (output: BasicOutput) => {
    if (output.type === OutputType.Basic || output.type === OutputType.Nft) {
      return output.unlockConditions.find(
        (c) => c.type === UnlockConditionType.Address,
      ) as AddressUnlockCondition;
    }
    if (output.type === OutputType.Alias) {
      const condition = output.unlockConditions.find(
        (c) => c.type === UnlockConditionType.StateControllerAddress,
      ) as StateControllerAddressUnlockCondition;
      return (condition ||
        output.unlockConditions.find(
          (c) => c.type === UnlockConditionType.GovernorAddress,
        )) as GovernorAddressUnlockCondition;
    }
    if (output.type === OutputType.Foundry) {
      return output.unlockConditions.find(
        (c) => c.type === UnlockConditionType.ImmutableAliasAddress,
      ) as ImmutableAliasAddressUnlockCondition;
    }
    return;
  };

  public static addressToBech32(address: Address, hrp: string): string {
    switch (address.type) {
      case AddressType.Ed25519:
        return Utils.hexToBech32((address as Ed25519Address).pubKeyHash, hrp);
      case AddressType.Alias:
        return Utils.aliasIdToBech32((address as AliasAddress).aliasId, hrp);
      case AddressType.Nft:
        return Utils.aliasIdToBech32((address as NftAddress).nftId, hrp);
    }
  }
}
