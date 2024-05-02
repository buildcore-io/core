import { database } from '@buildcore/database';
import {
  Award,
  COL,
  Member,
  Network,
  SOON_PROJECT_ID,
  Space,
  Token,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { NftOutput } from '@iota/sdk';
import dayjs from 'dayjs';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomSymbol, wait } from '../../test/controls/common';
import { MEDIA, getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { getNftMetadata } from '../collection-minting/Helper';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

const network = Network.RMS;

describe('Create award, base', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let award: Award;
  let walletService: Wallet;
  let token: Token;
  let guardianAddress: AddressDetails;

  beforeAll(async () => {
    walletService = await getWallet(network);
  });

  beforeEach(async () => {
    guardian = await testEnv.createMember();
    member = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);

    token = await saveToken(space.uid, guardian);

    mockWalletReturnValue(guardian, awardRequest(space.uid, token.symbol));
    award = await testEnv.wrap(WEN_FUNC.createAward);

    const guardianDocRef = database().doc(COL.MEMBER, guardian);
    const guardianData = <Member>await guardianDocRef.get();
    const guardianBech32 = getAddress(guardianData, network);
    guardianAddress = await walletService.getAddressDetails(guardianBech32);
  });

  it('Should set correct metadata on award collection and ntt', async () => {
    mockWalletReturnValue(guardian, { uid: award.uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.fundAward);

    await requestFundsFromFaucet(network, guardianAddress.bech32, order.payload.amount);
    await requestMintedTokenFromFaucet(
      walletService,
      guardianAddress,
      MINTED_TOKEN_ID,
      VAULT_MNEMONIC,
      10,
    );
    await walletService.send(guardianAddress, order.payload.targetAddress!, order.payload.amount!, {
      nativeTokens: [{ id: MINTED_TOKEN_ID, amount: BigInt('0xA') }],
    });
    await MnemonicService.store(guardianAddress.bech32, guardianAddress.mnemonic);

    const awardDocRef = database().doc(COL.AWARD, award.uid);
    await wait(async () => {
      award = <Award>await awardDocRef.get();
      return award.approved && award.funded;
    });

    mockWalletReturnValue(guardian, { award: award.uid, members: [member, member] });
    await testEnv.wrap(WEN_FUNC.approveParticipantAward);

    const memberDocRef = database().doc(COL.MEMBER, member);
    const memberData = <Member>await memberDocRef.get();
    const memberBech32 = getAddress(memberData, network);

    const nttQuery = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload_type', '==', TransactionPayloadType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.length === 2;
    });

    await wait(async () => {
      const response = await walletService.client.nftOutputIds([{ address: memberBech32 }]);
      return response.items.length === 2;
    });

    const spaceDocRef = database().doc(COL.SPACE, space.uid);
    space = <Space>await spaceDocRef.get();
    expect(space.ipfsMedia).toBeDefined();

    const collectionOutputId = await walletService.client.nftOutputId(award.collectionId!);
    const collectionOutput = (await walletService.client.getOutput(collectionOutputId)).output;
    const collectionMetadata = getNftMetadata(collectionOutput as NftOutput);
    expect(collectionMetadata.standard).toBe('IRC27');
    expect(collectionMetadata.version).toBe('v1.0');
    expect(collectionMetadata.type).toBe('image/png');
    expect(collectionMetadata.uri).toBe(`ipfs://${space.ipfsMedia}`);
    expect(collectionMetadata.name).toBe('award');
    expect(collectionMetadata.description).toBe('awarddesc');
    expect(collectionMetadata.issuerName).toBe('BUILD.5');
    expect(collectionMetadata.originId).toBe(award.uid);

    const nttItems = (await walletService.client.nftOutputIds([{ address: memberBech32 }])).items;
    const promises = nttItems.map(
      async (outputId) => (await walletService.client.getOutput(outputId)).output as NftOutput,
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
      expect(nttMetadata.issuerName).toBe('BUILD.5');
      expect(nttMetadata.collectionId).toBe(award.collectionId);
      expect(nttMetadata.collectionName).toBe('award');

      const transactionDocRef = database().doc(COL.TRANSACTION, nttMetadata.originId);
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
    project: SOON_PROJECT_ID,
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
  } as Token;
  await database().doc(COL.TOKEN, token.uid).create(token);
  return token;
};

export const VAULT_MNEMONIC =
  'figure random fitness double guard write auction penalty mimic office capital asthma laptop rifle club chuckle organ era prepare unit road echo bundle shrug';
export const MINTED_TOKEN_ID =
  '0x08f33de73663373e0c0fa11cb4c93bf83c7905357573882a21a001d2ddc176d57e0100000000';
