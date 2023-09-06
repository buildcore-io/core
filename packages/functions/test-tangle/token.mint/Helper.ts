import { build5Db } from '@build-5/database';
import { COL, Member, Network, SUB_COL, Space, Token, TokenStatus } from '@build-5/interfaces';
import {
  ALIAS_UNLOCK_TYPE,
  Bech32Helper,
  ED25519_ADDRESS_TYPE,
  IAliasOutput,
  IEd25519Address,
  IFoundryOutput,
  IGovernorAddressUnlockCondition,
  IMetadataFeature,
  IndexerPluginClient,
  METADATA_FEATURE_TYPE,
  REFERENCE_UNLOCK_TYPE,
  TransactionHelper,
  UnlockTypes,
} from '@iota/iota.js-next';
import { Converter, HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import { cloneDeep } from 'lodash';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { packBasicOutput } from '../../src/utils/basic-output.utils';
import { packEssence, packPayload, submitBlock } from '../../src/utils/block.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import { createUnlock } from '../../src/utils/smr.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { createMember, createSpace, getRandomSymbol } from '../../test/controls/common';
import { MEDIA, getWallet } from '../../test/set-up';

export class Helper {
  public guardian: Member = {} as any;
  public address: AddressDetails = {} as any;
  public space: Space = {} as any;
  public token: Token = {} as any;
  public walletService: SmrWallet = {} as any;
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
    this.walletService = (await getWallet(this.network)) as SmrWallet;
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
    wallet: SmrWallet,
    token: Token,
    amount: number,
    fromAddress: string,
  ) => {
    const outputs = await wallet.getOutputs(fromAddress, [], false);
    const nativeTokens = Object.values(outputs)
      .map((o) => o.nativeTokens![0].amount)
      .reduce((acc, act) => acc + Number(act), 0);

    const indexer = new IndexerPluginClient(wallet.client);
    const aliasOutputId = (await indexer.alias(token.mintingData?.aliasId!)).items[0];
    const aliasOutput = <IAliasOutput>(await wallet.client.output(aliasOutputId)).output;

    const foundryOutputId = (await indexer.foundry(token.mintingData?.tokenId!)).items[0];
    const foundryOutput = <IFoundryOutput>(await wallet.client.output(foundryOutputId)).output;

    const nextAliasOutput = cloneDeep(aliasOutput);
    nextAliasOutput.stateIndex++;

    const nextFoundryOutput = cloneDeep(foundryOutput);
    nextFoundryOutput.tokenScheme.meltedTokens = HexHelper.fromBigInt256(bigInt(amount));

    const output = packBasicOutput(
      fromAddress,
      0,
      [
        {
          amount: HexHelper.fromBigInt256(bigInt(nativeTokens - amount)),
          id: token.mintingData?.tokenId!,
        },
      ],
      wallet.info,
    );

    const inputs = [aliasOutputId, foundryOutputId, ...Object.keys(outputs)].map(
      TransactionHelper.inputFromOutputId,
    );
    const inputsCommitment = TransactionHelper.getInputsCommitment([
      aliasOutput,
      foundryOutput,
      ...Object.values(outputs),
    ]);
    const essence = packEssence(
      inputs,
      inputsCommitment,
      [nextAliasOutput, nextFoundryOutput, output],
      wallet,
      {},
    );

    const address = await wallet.getAddressDetails(fromAddress);
    const unlocks: UnlockTypes[] = [
      createUnlock(essence, address.keyPair),
      { type: ALIAS_UNLOCK_TYPE, reference: 0 },
      { type: REFERENCE_UNLOCK_TYPE, reference: 0 },
    ];

    return await submitBlock(wallet, packPayload(essence, unlocks));
  };
}

export const getAliasOutput = async (wallet: SmrWallet, aliasId: string) => {
  const indexer = new IndexerPluginClient(wallet.client);
  const response = await indexer.alias(aliasId);
  const outputResponse = await wallet.client.output(response.items[0]);
  return outputResponse.output as IAliasOutput;
};

export const getStateAndGovernorAddress = async (wallet: SmrWallet, alias: IAliasOutput) => {
  const hrp = wallet.info.protocol.bech32Hrp;
  return (alias.unlockConditions as IGovernorAddressUnlockCondition[])
    .map((uc) => (uc.address as IEd25519Address).pubKeyHash)
    .map((pubHash) =>
      Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, Converter.hexToBytes(pubHash), hrp),
    );
};

export const getFoundryMetadata = (foundry: IFoundryOutput | undefined) => {
  try {
    const hexMetadata = <IMetadataFeature | undefined>(
      foundry?.immutableFeatures?.find((f) => f.type === METADATA_FEATURE_TYPE)
    );
    if (!hexMetadata?.data) {
      return {};
    }
    return JSON.parse(Converter.hexToUtf8(hexMetadata.data) || '{}');
  } catch {
    return {};
  }
};
