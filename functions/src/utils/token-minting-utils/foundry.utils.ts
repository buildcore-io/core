import * as lib from "@iota/iota.js-next";
import { IAliasOutput, IFoundryOutput, INodeInfo, TransactionHelper } from "@iota/iota.js-next";
import { Converter, HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import { Token } from "../../../interfaces/models";
import { AddressDetails } from "../../services/wallet/wallet";
import { packBasicOutput } from "../basic-output.utils";

export const createFoundryOutput = (maximumSupply: number, alias: lib.IAliasOutput, metadata: string, info: INodeInfo): lib.IFoundryOutput => {
  const output: IFoundryOutput = ({
    type: lib.FOUNDRY_OUTPUT_TYPE,
    amount: "0",
    serialNumber: alias.foundryCounter,
    tokenScheme: {
      type: lib.SIMPLE_TOKEN_SCHEME_TYPE,
      mintedTokens: HexHelper.fromBigInt256(bigInt(maximumSupply)),
      meltedTokens: HexHelper.fromBigInt256(bigInt(0)),
      maximumSupply: HexHelper.fromBigInt256(bigInt(maximumSupply)),
    },
    unlockConditions: [{ type: lib.IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE, address: { type: lib.ALIAS_ADDRESS_TYPE, aliasId: alias.aliasId } }],
    immutableFeatures: [{ type: lib.METADATA_FEATURE_TYPE, data: Converter.utf8ToHex(metadata, true) }]
  })
  output.amount = TransactionHelper.getStorageDeposit(output, info.protocol.rentStructure).toString()
  return output
}

export const getVaultAndGuardianOutput = async (
  aliasOutput: IAliasOutput,
  foundryOutput: IFoundryOutput,
  totalDistributed: number,
  source: AddressDetails,
  targetBech32: string,
  totalSupply: number,
  info: INodeInfo
) => {
  const tokenId = TransactionHelper.constructTokenId(aliasOutput.aliasId, foundryOutput.serialNumber, foundryOutput.tokenScheme.type);
  const guardianOutput = packBasicOutput(targetBech32, 0, [{ amount: HexHelper.fromBigInt256(bigInt(totalSupply - totalDistributed)), id: tokenId }], info)
  const vaultOutput = packBasicOutput(source.bech32, 0, [{ amount: HexHelper.fromBigInt256(bigInt(totalDistributed)), id: tokenId }], info)
  return [vaultOutput, guardianOutput].filter(o => Number(o.nativeTokens![0].amount) > 0)
}

export const tokenToFoundryMetadata = (token: Token) => JSON.stringify({
  "standard": "IRC30",
  "name": token.name,
  "symbol": token.symbol.toLowerCase(),
  "decimals": 6
})
