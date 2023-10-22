import {
  COL,
  Member,
  Network,
  NetworkAddress,
  SUB_COL,
  Space,
  Token,
  TokenStatus,
} from '@build-5/interfaces';

import { build5Db } from '@build-5/database';
import {
  AliasOutput,
  AliasOutputBuilderParams,
  AliasUnlock,
  Ed25519Address,
  FeatureType,
  FoundryOutput,
  GovernorAddressUnlockCondition,
  MetadataFeature,
  ReferenceUnlock,
  UTXOInput,
  Unlock,
  Utils,
  hexToUtf8,
} from '@iota/sdk';
import { cloneDeep } from 'lodash';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { packBasicOutput } from '../../src/utils/basic-output.utils';
import { createUnlock, packEssence, submitBlock } from '../../src/utils/block.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { createMember, createSpace, getRandomSymbol } from '../../test/controls/common';
import { MEDIA, getWallet } from '../../test/set-up';

export class Helper {
  public guardian: Member = {} as any;
  public address: AddressDetails = {} as any;
  public space: Space = {} as any;
  public token: Token = {} as any;
  public walletService: Wallet = {} as any;
  public member: string = '';
  public walletSpy: any = {} as any;
  public network = Network.RMS;
  public totalSupply = 1500;

  public beforeEach = async () => {
    this.walletSpy = jest.spyOn(wallet, 'decodeAuth');
  };

  public setup = async (approved = true, isPublicToken?: boolean) => {
    const guardianId = await createMember(this.walletSpy);
    this.member = await createMember(this.walletSpy);
    this.guardian = <Member>await build5Db().doc(`${COL.MEMBER}/${guardianId}`).get();
    this.space = await createSpace(this.walletSpy, this.guardian.uid);
    this.token = await this.saveToken(
      this.space.uid,
      this.guardian.uid,
      this.member,
      approved,
      isPublicToken,
    );
    this.walletService = await getWallet(this.network);
    this.address = await this.walletService.getAddressDetails(
      getAddress(this.guardian, this.network),
    );
  };

  public saveToken = async (
    space: string,
    guardian: string,
    member: string,
    approved = true,
    isPublicToken = true,
  ) => {
    const tokenId = getRandomEthAddress();
    const token = {
      symbol: getRandomSymbol(),
      totalSupply: this.totalSupply,
      updatedOn: serverTime(),
      createdOn: serverTime(),
      space,
      uid: tokenId,
      createdBy: guardian,
      name: 'MyToken',
      status: TokenStatus.AVAILABLE,
      access: 0,
      icon: MEDIA,
      public: isPublicToken,
      approved,
      decimals: 5,
    };
    await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
    await build5Db()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${member}`)
      .set({ tokenOwned: 1000 });
    return <Token>token;
  };

  public meltMintedToken = async (
    wallet: Wallet,
    token: Token,
    amount: number,
    fromAddress: NetworkAddress,
  ) => {
    const outputs = await wallet.getOutputs(fromAddress, [], false);
    const nativeTokens = Object.values(outputs)
      .map((o) => o.nativeTokens![0].amount)
      .reduce((acc, act) => acc + Number(act), 0);

    const aliasOutputId = await this.walletService.client.aliasOutputId(
      token.mintingData?.aliasId!,
    );
    const aliasOutput = <AliasOutput>(await wallet.client.getOutput(aliasOutputId)).output;

    const foundryOutputId = await this.walletService.client.foundryOutputId(
      token.mintingData?.tokenId!,
    );
    const foundryOutput = <FoundryOutput>(await wallet.client.getOutput(foundryOutputId)).output;

    const nextAliasOutput: AliasOutputBuilderParams = cloneDeep(aliasOutput);
    nextAliasOutput.stateIndex!++;

    const nextFoundryOutput: any = cloneDeep(foundryOutput);
    nextFoundryOutput.tokenScheme.meltedTokens = BigInt(amount);

    const output = await packBasicOutput(this.walletService, fromAddress, 0, {
      nativeTokens: [{ amount: BigInt(nativeTokens - amount), id: token.mintingData?.tokenId! }],
    });

    const inputs = [aliasOutputId, foundryOutputId, ...Object.keys(outputs)].map(
      UTXOInput.fromOutputId,
    );
    const inputsCommitment = Utils.computeInputsCommitment([
      aliasOutput,
      foundryOutput,
      ...Object.values(outputs),
    ]);
    const essence = await packEssence(
      this.walletService,
      inputs,
      inputsCommitment,
      [
        await this.walletService.client.buildAliasOutput(nextAliasOutput),
        nextFoundryOutput,
        output,
      ],
      {},
    );

    const address = await wallet.getAddressDetails(fromAddress);
    const unlocks: Unlock[] = [
      await createUnlock(essence, address),
      new AliasUnlock(0),
      new ReferenceUnlock(0),
    ];

    const blockId = await submitBlock(wallet, essence, unlocks);
    await build5Db().doc(`blocks/${blockId}`).create({ blockId });
    return blockId;
  };
}

export const getAliasOutput = async (wallet: Wallet, aliasId: string) => {
  const aliasOutputId = await wallet.client.aliasOutputId(aliasId);
  const outputResponse = await wallet.client.getOutput(aliasOutputId);
  return outputResponse.output as AliasOutput;
};

export const getStateAndGovernorAddress = async (wallet: Wallet, alias: AliasOutput) => {
  const hrp = wallet.info.protocol.bech32Hrp;
  return (alias.unlockConditions as GovernorAddressUnlockCondition[])
    .map((uc) => (uc.address as Ed25519Address).pubKeyHash)
    .map((pubHash) => Utils.hexToBech32(pubHash, hrp));
};

export const getFoundryMetadata = (foundry: FoundryOutput | undefined) => {
  try {
    const hexMetadata = <MetadataFeature | undefined>(
      foundry?.immutableFeatures?.find((f) => f.type === FeatureType.Metadata)
    );
    if (!hexMetadata?.data) {
      return {};
    }
    return JSON.parse(hexToUtf8(hexMetadata.data) || '{}');
  } catch {
    return {};
  }
};
