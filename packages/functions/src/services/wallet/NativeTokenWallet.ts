import {
  IAliasOutput,
  OutputTypes,
  REFERENCE_UNLOCK_TYPE,
  TransactionHelper,
  UnlockTypes,
} from '@iota/iota.js-next';
import { COL, Member, Token, Transaction } from '@soonaverse/interfaces';
import { cloneDeep } from 'lodash';
import admin from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { packBasicOutput } from '../../utils/basic-output.utils';
import { packEssence, packPayload, submitBlock } from '../../utils/block.utils';
import { createUnlock } from '../../utils/smr.utils';
import {
  createFoundryOutput,
  getVaultAndGuardianOutput,
  tokenToFoundryMetadata,
} from '../../utils/token-minting-utils/foundry.utils';
import { getOwnedTokenTotal } from '../../utils/token-minting-utils/member.utils';
import { getUnclaimedAirdropTotalValue } from '../../utils/token.utils';
import { MnemonicService } from './mnemonic';
import { AliasWallet } from './smr-wallets/AliasWallet';
import { SmrParams, SmrWallet } from './SmrWalletService';
import { setConsumedOutputIds } from './wallet';

export class NativeTokenWallet {
  constructor(private readonly wallet: SmrWallet) {}

  public mintFoundry = async (transaction: Transaction, params: SmrParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );
    const totalAmount = Object.values(outputsMap).reduce((acc, act) => acc + Number(act.amount), 0);

    const aliasWallet = new AliasWallet(this.wallet);
    const aliasOutputs = await aliasWallet.getAliasOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];

    const nextAliasOutput = cloneDeep(aliasOutput) as IAliasOutput;
    nextAliasOutput.aliasId = TransactionHelper.resolveIdFromOutputId(aliasOutputId);
    nextAliasOutput.stateIndex++;
    nextAliasOutput.foundryCounter++;

    const token = <Token>(
      (await admin.firestore().doc(`${COL.TOKEN}/${transaction.payload.token}`).get()).data()
    );

    const metadata = await tokenToFoundryMetadata(token);
    const foundryOutput = createFoundryOutput(
      token.totalSupply,
      nextAliasOutput,
      JSON.stringify(metadata),
      this.wallet.info,
    );

    const totalDistributed =
      (await getOwnedTokenTotal(token.uid)) + (await getUnclaimedAirdropTotalValue(token.uid));
    const member = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${transaction.member}`).get()).data()
    );
    const tokenId = TransactionHelper.constructTokenId(
      nextAliasOutput.aliasId,
      foundryOutput.serialNumber,
      foundryOutput.tokenScheme.type,
    );
    const { vaultOutput, guardianOutput } = await getVaultAndGuardianOutput(
      tokenId,
      token.totalSupply,
      totalDistributed,
      sourceAddress.bech32,
      getAddress(member, transaction.network!),
      this.wallet.info,
    );
    const remainderAmount = [foundryOutput, vaultOutput, guardianOutput].reduce(
      (acc, act) => acc - Number(act?.amount || 0),
      totalAmount,
    );
    const remainder = packBasicOutput(sourceAddress.bech32, remainderAmount, [], this.wallet.info);

    const inputs = [...Object.keys(outputsMap), aliasOutputId].map(
      TransactionHelper.inputFromOutputId,
    );
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      ...Object.values(outputsMap),
      aliasOutput,
    ]);

    const baseOutputs = [nextAliasOutput, foundryOutput, vaultOutput, guardianOutput].filter(
      (o) => o !== undefined,
    ) as OutputTypes[];
    const outputs = remainderAmount ? [...baseOutputs, remainder] : baseOutputs;
    const essence = packEssence(inputs, inputsCommitment, outputs, this.wallet, params);
    const unlocks: UnlockTypes[] = [
      createUnlock(essence, sourceAddress.keyPair),
      { type: REFERENCE_UNLOCK_TYPE, reference: 0 },
    ];

    await setConsumedOutputIds(sourceAddress.bech32, Object.keys(outputsMap), [], [aliasOutputId]);
    return submitBlock(this.wallet, packPayload(essence, unlocks));
  };
}
