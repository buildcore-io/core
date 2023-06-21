import {
  Award,
  COL,
  Member,
  Network,
  Space,
  Token,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
} from '@build-5/interfaces';
import { INftOutput, IndexerPluginClient } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { approveAwardParticipant, createAward, fundAward } from '../../src/runtime/firebase/award';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import {
  createMember,
  createSpace,
  getRandomSymbol,
  mockWalletReturnValue,
  wait,
} from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';
import { getNftMetadata } from '../collection-minting/Helper';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

const network = Network.RMS;
let walletSpy: any;

describe('Create award, base', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let walletService: SmrWallet;
  let token: Token;
  let guardianAddress: AddressDetails;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletService = (await WalletService.newWallet(network)) as SmrWallet;
  });

  beforeEach(async () => {
    guardian = await createMember(walletSpy);
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    token = await saveToken(space.uid, guardian);

    mockWalletReturnValue(walletSpy, guardian, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(createAward)({});

    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${guardian}`);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should set correct metadata on award collection and ntt', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: award.uid });
    const order = await testEnv.wrap(fundAward)({});

    await requestFundsFromFaucet(network, guardianAddress.bech32, order.payload.amount);
    await requestMintedTokenFromFaucet(
      walletService,
      guardianAddress,
      MINTED_TOKEN_ID,
      VAULT_MNEMONIC,
      10,
    );
    await walletService.send(guardianAddress, order.payload.targetAddress, order.payload.amount, {
      nativeTokens: [{ id: MINTED_TOKEN_ID, amount: '0xA' }],
    });
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

    const awardDocRef = build5Db().doc(`${COL.AWARD}/${award.uid}`);
    await wait(async () => {
      award = <Award>await awardDocRef.get();
      return award.approved && award.funded;
    });

    mockWalletReturnValue(walletSpy, guardian, { award: award.uid, members: [member, member] });
    await testEnv.wrap(approveAwardParticipant)({});

    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${member}`);
    const memberData = <Member>await memberDocRef.get();
    const memberBech32 = getAddress(memberData, network);

    const nttQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload.type', '==', TransactionPayloadType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.length === 2;
    });

    const indexer = new IndexerPluginClient(walletService.client);

    await wait(async () => {
      const response = await indexer.nfts({ addressBech32: memberBech32 });
      return response.items.length === 2;
    });

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);
    space = <Space>await spaceDocRef.get();
    expect(space.ipfsMedia).toBeDefined();

    const collectionOutputItems = (await indexer.nft(award.collectionId!)).items;
    const collectionOutput = (await walletService.client.output(collectionOutputItems[0])).output;
    const collectionMetadata = getNftMetadata(collectionOutput as INftOutput);
    expect(collectionMetadata.standard).toBe('IRC27');
    expect(collectionMetadata.version).toBe('v1.0');
    expect(collectionMetadata.type).toBe('image/png');
    expect(collectionMetadata.uri).toBe(`ipfs://${space.ipfsMedia}`);
    expect(collectionMetadata.name).toBe('award');
    expect(collectionMetadata.description).toBe('awarddesc');
    expect(collectionMetadata.issuerName).toBe('Soonaverse');
    expect(collectionMetadata.build5Id).toBe(award.uid);

    const nttItems = (await indexer.nfts({ addressBech32: memberBech32 })).items;
    const promises = nttItems.map(
      async (outputId) => (await walletService.client.output(outputId)).output as INftOutput,
    );
    const outputs = await Promise.all(promises);

    const editions: number[] = [];
    for (const nttOutput of outputs) {
      const nttMetadata = getNftMetadata(nttOutput);
      expect(nttMetadata.standard).toBe('IRC27');
      expect(nttMetadata.version).toBe('v1.0');
      expect(nttMetadata.type).toBe('image/png');
      expect(nttMetadata.uri).toBe(
        'ipfs://bafkreiapx7kczhfukx34ldh3pxhdip5kgvh237dlhp55koefjo6tyupnj4',
      );
      expect(nttMetadata.name).toBe('badge');
      expect(nttMetadata.description).toBe('badgedesc');
      expect(nttMetadata.issuerName).toBe('Soonaverse');
      expect(nttMetadata.collectionId).toBe(award.collectionId);
      expect(nttMetadata.collectionName).toBe('award');

      const transactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${nttMetadata.build5Id}`);
      const transaction = <Transaction>await transactionDocRef.get();
      expect(getAttributeValue(nttMetadata, 'award')).toBe(award.uid);
      expect(getAttributeValue(nttMetadata, 'tokenReward')).toBe(5);
      expect(getAttributeValue(nttMetadata, 'tokenId')).toBe(MINTED_TOKEN_ID);
      expect(getAttributeValue(nttMetadata, 'edition')).toBe(transaction.payload.edition);
      editions.push(transaction.payload.edition!);
      expect(getAttributeValue(nttMetadata, 'participated_on')).toBe(
        dayjs(transaction.payload.participatedOn!.toDate()).unix(),
      );
    }
    expect(editions.sort()).toEqual([1, 2]);
  });
});

const getAttributeValue = (metadata: any, type: string) =>
  metadata.attributes.find((a: any) => a.trait_type === type).value;

const awardRequest = (space: string, tokenSymbol: string) => ({
  name: 'award',
  description: 'awarddesc',
  space,
  endDate: dayjs().add(2, 'd').toDate(),
  badge: {
    name: 'badge',
    description: 'badgedesc',
    total: 2,
    image: MEDIA,
    tokenReward: 5,
    tokenSymbol,
    lockTime: 31557600000,
  },
  network,
});

const saveToken = async (space: string, guardian: string) => {
  const token = {
    symbol: getRandomSymbol(),
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: wallet.getRandomEthAddress(),
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.MINTED,
    access: 0,
    icon: MEDIA,
    mintingData: {
      network: Network.RMS,
      tokenId: MINTED_TOKEN_ID,
    },
  };
  await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token;
};

export const VAULT_MNEMONIC =
  'media income depth opera health hybrid person expect supply kid napkin science maze believe they inspire hockey random escape size below monkey lemon veteran';

export const MINTED_TOKEN_ID =
  '0x08f56bb2eefc47c050e67f8ba85d4a08e1de5ac0580fb9e80dc2f62eab97f944350100000000';
