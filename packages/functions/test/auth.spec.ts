import { database } from '@buildcore/database';
import { COL, Member, Network, WEN_FUNC, WenError } from '@buildcore/interfaces';
import { CoinType, utf8ToHex } from '@iota/sdk';
import jwt from 'jsonwebtoken';
import { get } from 'lodash';
import * as config from '../src/utils/config.utils';
import { getJwtSecretKey } from '../src/utils/config.utils';
import { getSecretManager } from '../src/utils/secret.manager.utils';
import { decodeAuth, getRandomNonce } from '../src/utils/wallet.utils';
import { expectThrow } from './controls/common';
import { PROJECT_API_KEY, getWallet, mockWalletReturnValue, testEnv } from './set-up';

describe('Auth control test', () => {
  let configSpy: jest.SpyInstance;
  let member: string;

  beforeEach(async () => {
    member = await testEnv.createMember();
  });

  it('Should create and reuse custom token', async () => {
    mockWalletReturnValue(member, {});
    const tokenGeneratedWithToken = await testEnv.wrap<string>(WEN_FUNC.generateCustomToken);
    expect(tokenGeneratedWithToken).toBeDefined();
    const decoded = jwt.verify(tokenGeneratedWithToken, getJwtSecretKey());
    expect(get(decoded, 'uid')).toBe(member);
    expect(get(decoded, 'iat')).toBeDefined();
    expect(get(decoded, 'exp')).toBeDefined();
  });

  it('Should throw, custom token for func expired', async () => {
    mockWalletReturnValue(member, undefined);
    const token = await testEnv.wrap<string>(WEN_FUNC.generateCustomToken);
    configSpy = jest.spyOn(config, 'getCustomTokenLifetime');
    configSpy.mockReturnValue(1);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const call = decodeAuth(
      {
        address: member,
        projectApiKey: PROJECT_API_KEY,
        signature: '',
        publicKey: {} as any,
        customToken: token,
        body: {},
      },
      WEN_FUNC.generateCustomToken,
    );
    await expectThrow(call, WenError.invalid_custom_token.key);
    configSpy.mockRestore();
  });
});

describe('Pub key test', () => {
  it.each([Network.RMS, Network.SMR])('Should validate SMR pub key', async (network: Network) => {
    const wallet = await getWallet(network);
    const address = await wallet.getNewIotaAddressDetails();
    const nonce = getRandomNonce();
    const userDocRef = database().doc(COL.MEMBER, address.bech32);
    await userDocRef.create({ uid: address.bech32, nonce });
    const secretManager = getSecretManager(address.mnemonic);
    const signature = await secretManager.signEd25519(utf8ToHex(nonce), {
      coinType: CoinType.IOTA,
    });
    const request = {
      address: 'address',
      projectApiKey: PROJECT_API_KEY,
      signature: signature.signature,
      publicKey: { hex: signature.publicKey, network },
      body: {},
    };
    const result = await decodeAuth(request, WEN_FUNC.approveProposal);
    expect(result.address).toBe(address.bech32);
    const user = <Member>await userDocRef.get();
    expect(user.validatedAddress![network]).toBe(address.bech32);
  });

  it.each([Network.IOTA, Network.ATOI])(
    'Should validate IOTA pub key',
    async (network: Network) => {
      const wallet = await getWallet(network);
      const address = await wallet.getNewIotaAddressDetails();
      const nonce = getRandomNonce();
      const userDocRef = database().doc(COL.MEMBER, address.bech32);
      await userDocRef.create({ uid: address.bech32, nonce });
      const secretManager = getSecretManager(address.mnemonic);
      const signature = await secretManager.signEd25519(utf8ToHex(nonce), {
        coinType: CoinType.IOTA,
      });
      const request = {
        address: address.bech32,
        signature: signature.signature,
        projectApiKey: PROJECT_API_KEY,
        publicKey: { hex: signature.publicKey, network },
        body: {},
      };
      const result = await decodeAuth(request, WEN_FUNC.approveProposal);
      expect(result.address).toBe(address.bech32);
      const user = <Member>await userDocRef.get();
      expect(user.validatedAddress![network]).toBe(address.bech32);
    },
  );

  it.each([Network.RMS, Network.SMR])('Should throw wrong pub key', async (network: Network) => {
    const wallet = await getWallet(network);
    const address = await wallet.getNewIotaAddressDetails();
    const nonce = getRandomNonce();
    const userDocRef = database().doc(COL.MEMBER, address.bech32);
    await userDocRef.create({ uid: address.bech32, nonce });
    const secretManager = getSecretManager(address.mnemonic);
    const signature = await secretManager.signEd25519(utf8ToHex(nonce), {
      coinType: CoinType.IOTA,
    });
    const wallet2 = await getWallet(network === Network.SMR ? Network.RMS : Network.SMR);
    const secondAddress = await wallet2.getNewIotaAddressDetails();
    const secretManagerSecond = getSecretManager(secondAddress.mnemonic);
    const signatureSecond = await secretManagerSecond.signEd25519(utf8ToHex(nonce), {
      coinType: CoinType.IOTA,
    });
    const request = {
      address: 'address',
      projectApiKey: PROJECT_API_KEY,
      signature: signature.signature,
      publicKey: { hex: signatureSecond.publicKey, network },
      body: {},
    };
    await expectThrow(
      decodeAuth(request, WEN_FUNC.approveProposal),
      WenError.failed_to_decode_token.key,
    );
  });

  it('Should update nonce when public key sign in', async () => {
    const wallet = await getWallet(Network.RMS);
    const address = await wallet.getNewIotaAddressDetails();
    const nonce = getRandomNonce();
    const userDocRef = database().doc(COL.MEMBER, address.bech32);
    await userDocRef.create({ uid: address.bech32, nonce });
    const secretManager = getSecretManager(address.mnemonic);
    const signature = await secretManager.signEd25519(utf8ToHex(nonce), {
      coinType: CoinType.IOTA,
    });
    const request = {
      address: 'address',
      signature: signature.signature,
      projectApiKey: PROJECT_API_KEY,
      publicKey: { hex: signature.publicKey, network: Network.RMS },
      body: {},
    };
    const result = await decodeAuth(request, WEN_FUNC.approveProposal);
    expect(result.address).toBe(address.bech32);
    const user = <Member>await userDocRef.get();
    expect(user.validatedAddress![Network.RMS]).toBe(address.bech32);
    expect(user.nonce).not.toBe(nonce);
  });
});
