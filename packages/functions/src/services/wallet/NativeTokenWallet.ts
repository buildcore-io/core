import { COL, Member, Token, Transaction } from '@build-5/interfaces';
import {
  AliasOutputBuilderParams,
  Client,
  Output,
  ReferenceUnlock,
  UTXOInput,
  Unlock,
  Utils,
} from '@iota/sdk';
import { cloneDeep } from 'lodash';
import { build5Db } from '../../firebase/firestore/build5Db';
import { getAddress } from '../../utils/address.utils';
import { mergeOutputs } from '../../utils/basic-output.utils';
import { createUnlock, packEssence, submitBlock } from '../../utils/block.utils';
import {
  createFoundryOutput,
  getVaultAndGuardianOutput,
  tokenToFoundryMetadata,
} from '../../utils/token-minting-utils/foundry.utils';
import { getOwnedTokenTotal } from '../../utils/token-minting-utils/member.utils';
import { getUnclaimedAirdropTotalValue } from '../../utils/token.utils';
import { AliasWallet } from './AliasWallet';
import { MnemonicService } from './mnemonic';
import { Wallet, WalletParams } from './wallet';
import { setConsumedOutputIds } from './wallet.service';

export class NativeTokenWallet {
  private client: Client;
  constructor(private readonly wallet: Wallet) {
    this.client = this.wallet.client;
  }

  public mintFoundry = async (transaction: Transaction, params: WalletParams) => {
    const sourceAddress = await this.wallet.getAddressDetails(transaction.payload.sourceAddress!);
    const sourceMnemonic = await MnemonicService.getData(sourceAddress.bech32);

    const outputsMap = await this.wallet.getOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedOutputIds,
      false,
    );

    const aliasWallet = new AliasWallet(this.wallet);
    const aliasOutputs = await aliasWallet.getAliasOutputs(
      sourceAddress.bech32,
      sourceMnemonic.consumedAliasOutputIds,
    );
    const [aliasOutputId, aliasOutput] = Object.entries(aliasOutputs)[0];

    const nextAliasOutput: AliasOutputBuilderParams = cloneDeep(aliasOutput);
    nextAliasOutput.aliasId = Utils.computeAliasId(aliasOutputId);
    nextAliasOutput.stateIndex!++;
    nextAliasOutput.foundryCounter!++;

    const token = <Token>await build5Db().doc(`${COL.TOKEN}/${transaction.payload.token}`).get();

    const metadata = await tokenToFoundryMetadata(token);
    const foundryOutput = await createFoundryOutput(
      this.wallet,
      token.totalSupply,
      await this.client.buildAliasOutput(nextAliasOutput),
      JSON.stringify(metadata),
    );

    const totalDistributed =
      (await getOwnedTokenTotal(token.uid)) + (await getUnclaimedAirdropTotalValue(token.uid));
    const member = <Member>await build5Db().doc(`${COL.MEMBER}/${transaction.member}`).get();
    const tokenId = Utils.computeFoundryId(
      nextAliasOutput.aliasId,
      foundryOutput.serialNumber,
      foundryOutput.tokenScheme.type,
    );
    const { vaultOutput, guardianOutput } = await getVaultAndGuardianOutput(
      this.wallet,
      tokenId,
      token.totalSupply,
      totalDistributed,
      sourceAddress.bech32,
      getAddress(member, transaction.network!),
    );
    const consumedAmount = [foundryOutput, vaultOutput, guardianOutput].reduce(
      (acc, act) => acc + Number(act?.amount || 0),
      0,
    );

    const inputs = [...Object.keys(outputsMap), aliasOutputId].map(UTXOInput.fromOutputId);
    const inputsCommitment = Utils.computeInputsCommitment([
      ...Object.values(outputsMap),
      aliasOutput,
    ]);

    const baseOutputs = [nextAliasOutput, foundryOutput, vaultOutput, guardianOutput].filter(
      (o) => o !== undefined,
    ) as Output[];
    const outputs = [...baseOutputs];

    const remainderParams = mergeOutputs(Object.values(outputsMap));
    remainderParams.amount = (Number(remainderParams.amount) - consumedAmount).toString();
    if (Number(remainderParams.amount)) {
      outputs.push(await this.client.buildBasicOutput(remainderParams));
    }
    const essence = await packEssence(this.wallet, inputs, inputsCommitment, outputs, params);
    const unlocks: Unlock[] = [await createUnlock(essence, sourceAddress), new ReferenceUnlock(0)];

    await setConsumedOutputIds(sourceAddress.bech32, Object.keys(outputsMap), [], [aliasOutputId]);
    return submitBlock(this.wallet, essence, unlocks);
  };
}
