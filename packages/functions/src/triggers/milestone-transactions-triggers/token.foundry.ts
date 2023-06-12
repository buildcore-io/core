import { COL } from '@build5/interfaces';
import {
  FOUNDRY_OUTPUT_TYPE,
  IAddressUnlockCondition,
  IAliasAddress,
  IFoundryOutput,
  IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE,
  ITransactionPayload,
  OutputTypes,
  TransactionHelper,
} from '@iota/iota.js-next';
import { soonDb } from '../../firebase/firestore/soondb';
import { getTokenByMintId } from '../../utils/token.utils';

export const updateTokenSupplyData = async (data: Record<string, unknown>) => {
  const foundryOutputs = ((data.payload as ITransactionPayload).essence.outputs as OutputTypes[])
    .filter((o) => o.type === FOUNDRY_OUTPUT_TYPE)
    .map((o) => <IFoundryOutput>o);
  for (const foundryOutput of foundryOutputs) {
    const tokenId = TransactionHelper.constructTokenId(
      getAliasAddress(foundryOutput),
      foundryOutput.serialNumber,
      foundryOutput.tokenScheme.type,
    );
    const token = await getTokenByMintId(tokenId);
    if (!token) {
      continue;
    }
    const meltedTokens = Number(foundryOutput.tokenScheme.meltedTokens);
    const totalSupply = Number(foundryOutput.tokenScheme.maximumSupply);
    const tokendDocRef = soonDb().doc(`${COL.TOKEN}/${token.uid}`);
    await tokendDocRef.update({
      'mintingData.meltedTokens': meltedTokens,
      'mintingData.circulatingSupply': totalSupply - meltedTokens,
    });
  }
};

const getAliasAddress = (output: IFoundryOutput) => {
  const aliasUnlock = <IAddressUnlockCondition>(
    output.unlockConditions.find((uc) => uc.type === IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE)!
  );
  return (<IAliasAddress>aliasUnlock.address).aliasId;
};
