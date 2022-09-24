import * as lib from "@iota/iota.js-next";
import { ALIAS_ADDRESS_TYPE, Bech32Helper, IAliasOutput, INodeInfo, TransactionHelper } from "@iota/iota.js-next";
import { Converter, HexHelper } from "@iota/util.js-next";
import { AddressDetails } from "../../services/wallet/wallet";

export const createAliasOutput = (sourceAddress: AddressDetails, info: INodeInfo): lib.IAliasOutput => {
  const address: lib.AddressTypes = { type: lib.ED25519_ADDRESS_TYPE, pubKeyHash: sourceAddress.hex }
  const output: IAliasOutput = {
    type: lib.ALIAS_OUTPUT_TYPE,
    amount: '0',
    aliasId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    stateIndex: 0,
    foundryCounter: 0,
    immutableFeatures: [{ type: lib.ISSUER_FEATURE_TYPE, address }],
    unlockConditions: [
      { type: lib.STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE, address },
      { type: lib.GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE, address }
    ]
  }
  output.amount = TransactionHelper.getStorageDeposit(output, info.protocol.rentStructure).toString()
  return output
}

export const getAliasBech32Address = (aliasId: string, info: INodeInfo) =>
  Bech32Helper.toBech32(ALIAS_ADDRESS_TYPE, Converter.hexToBytes(HexHelper.stripPrefix(aliasId)), info.protocol.bech32Hrp)
