import { COL } from '@build-5/interfaces';
import {
  AddressUnlockCondition,
  AliasAddress,
  FoundryOutput,
  OutputType,
  RegularTransactionEssence,
  SimpleTokenScheme,
  TransactionPayload,
  UnlockConditionType,
  Utils,
} from '@iota/sdk';
import { build5Db } from '../../firebase/firestore/build5Db';
import { getTokenByMintId } from '../../utils/token.utils';

export const updateTokenSupplyData = async (data: Record<string, unknown>) => {
  const foundryOutputs = (
    (data.payload as TransactionPayload).essence as RegularTransactionEssence
  ).outputs
    .filter((o) => o.type === OutputType.Foundry)
    .map((o) => <FoundryOutput>o);
  for (const foundryOutput of foundryOutputs) {
    const tokenId = Utils.computeFoundryId(
      getAliasAddress(foundryOutput),
      foundryOutput.serialNumber,
      foundryOutput.tokenScheme.type,
    );
    const token = await getTokenByMintId(tokenId);
    if (!token) {
      continue;
    }
    const tokenScheme = foundryOutput.tokenScheme as SimpleTokenScheme;
    const meltedTokens = Number(tokenScheme.meltedTokens);
    const totalSupply = Number(tokenScheme.maximumSupply);
    const tokendDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
    await tokendDocRef.update({
      'mintingData.meltedTokens': meltedTokens,
      'mintingData.circulatingSupply': totalSupply - meltedTokens,
    });
  }
};

const getAliasAddress = (output: FoundryOutput) => {
  const aliasUnlock = <AddressUnlockCondition>(
    output.unlockConditions.find((uc) => uc.type === UnlockConditionType.ImmutableAliasAddress)!
  );
  return (<AliasAddress>aliasUnlock.address).aliasId;
};
