import {
  FOUNDRY_OUTPUT_TYPE,
  IAddressUnlockCondition,
  IAliasAddress,
  IFoundryOutput,
  IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE,
  OutputTypes,
  TransactionHelper,
} from '@iota/iota.js-next';
import { COL } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { uOn } from '../../utils/dateTime.utils';

export const updateTokenSupplyData = async (
  doc: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
) => {
  const data = doc.data()!;
  const foundryOutputs = (data.payload.essence.outputs as OutputTypes[])
    .filter((o) => o.type === FOUNDRY_OUTPUT_TYPE)
    .map((o) => <IFoundryOutput>o);
  for (const foundryOutput of foundryOutputs) {
    const tokenId = TransactionHelper.constructTokenId(
      getAliasAddress(foundryOutput),
      foundryOutput.serialNumber,
      foundryOutput.tokenScheme.type,
    );
    const tokenSnap = await admin
      .firestore()
      .collection(COL.TOKEN)
      .where('mintingData.tokenId', '==', tokenId)
      .get();
    if (!tokenSnap.size) {
      continue;
    }
    const meltedTokens = Number(foundryOutput.tokenScheme.meltedTokens);
    const totalSupply = Number(foundryOutput.tokenScheme.maximumSupply);
    await tokenSnap.docs[0].ref.update(
      uOn({
        'mintingData.meltedTokens': meltedTokens,
        'mintingData.circulatingSupply': totalSupply - meltedTokens,
      }),
    );
  }
};

const getAliasAddress = (output: IFoundryOutput) => {
  const aliasUnlock = <IAddressUnlockCondition>(
    output.unlockConditions.find((uc) => uc.type === IMMUTABLE_ALIAS_UNLOCK_CONDITION_TYPE)!
  );
  return (<IAliasAddress>aliasUnlock.address).aliasId;
};
