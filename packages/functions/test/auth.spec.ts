import { COL, Member, Network, WEN_FUNC, WenError } from '@build-5/interfaces';
import { Ed25519 } from '@iota/crypto.js-next';
import { Converter } from '@iota/util.js-next';
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import jwt from 'jsonwebtoken';
import { get } from 'lodash';
import { build5Db } from '../src/firebase/firestore/build5Db';
import { generateCustomToken } from '../src/runtime/firebase/auth';
import { WalletService } from '../src/services/wallet/wallet.service';
import * as config from '../src/utils/config.utils';
import { getJwtSecretKey } from '../src/utils/config.utils';
import * as wallet from '../src/utils/wallet.utils';
import { decodeAuth, getRandomNonce } from '../src/utils/wallet.utils';
import { createMember, expectThrow, mockWalletReturnValue } from './controls/common';
import { testEnv } from './set-up';

jest.mock('@metamask/eth-sig-util');

describe('Auth control test', () => {
  let walletSpy: jest.SpyInstance;
  let configSpy: jest.SpyInstance;
  let member: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
  });

  it('Should create and reuse custom token', async () => {
    mockWalletReturnValue(walletSpy, member, {});
    const token = await testEnv.wrap(generateCustomToken)({});
    walletSpy.mockRestore();

    const tokenGeneratedWithToken = await testEnv.wrap(generateCustomToken)({
      address: member,
      customToken: token,
      body: {},
    });
    expect(tokenGeneratedWithToken).toBeDefined();
    const decoded = jwt.verify(tokenGeneratedWithToken, getJwtSecretKey());
    expect(get(decoded, 'uid')).toBe(member);
    expect(get(decoded, 'iat')).toBeDefined();
    expect(get(decoded, 'exp')).toBeDefined();
  });

  it('Should throw, custom token for func expired', async () => {
    mockWalletReturnValue(walletSpy, member, {});
    const token = await testEnv.wrap(generateCustomToken)({});
    walletSpy.mockRestore();

    configSpy = jest.spyOn(config, 'getCustomTokenLifetime');
    configSpy.mockReturnValue(1);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expectThrow(
      testEnv.wrap(generateCustomToken)({
        address: member,
        customToken: token,
        body: {},
      }),
      WenError.invalid_custom_token.key,
    );

    configSpy.mockRestore();
  });
});

describe('Pub key test', () => {
  it.each([Network.RMS, Network.SMR])('Should validate SMR pub key', async (network: Network) => {
    const wallet = await WalletService.newWallet(network);
    const address = await wallet.getNewIotaAddressDetails();

    const nonce = getRandomNonce();
    const userDocRef = build5Db().doc(`${COL.MEMBER}/${address.bech32}`);
    await userDocRef.create({ uid: address.bech32, nonce });

    const signature = Ed25519.sign(
      address.keyPair.privateKey,
      Converter.utf8ToBytes(`0x${toHex(nonce)}`),
    );
    const request = {
      address: 'address',
      signature: Converter.bytesToHex(signature),
      publicKey: {
        hex: Converter.bytesToHex(address.keyPair.publicKey),
        network,
      },
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
      const wallet = await WalletService.newWallet(network);
      const address = await wallet.getNewIotaAddressDetails();

      const nonce = getRandomNonce();
      const userDocRef = build5Db().doc(`${COL.MEMBER}/${address.bech32}`);
      await userDocRef.create({ uid: address.bech32, nonce });

      const signature = Ed25519.sign(
        address.keyPair.privateKey,
        Converter.utf8ToBytes(`0x${toHex(nonce)}`),
      );

      const request = {
        address: address.bech32,
        signature: Converter.bytesToHex(signature),
        publicKey: {
          hex: Converter.bytesToHex(address.keyPair.publicKey),
          network,
        },
        body: {},
      };

      const result = await decodeAuth(request, WEN_FUNC.approveProposal);

      expect(result.address).toBe(address.bech32);

      const user = <Member>await userDocRef.get();
      expect(user.validatedAddress![network]).toBe(address.bech32);
    },
  );

  it.each([Network.RMS, Network.SMR])('Should throw wrong pub key', async (network: Network) => {
    const wallet = await WalletService.newWallet(network);
    const address = await wallet.getNewIotaAddressDetails();

    const nonce = getRandomNonce();
    const userDocRef = build5Db().doc(`${COL.MEMBER}/${address.bech32}`);
    await userDocRef.create({ uid: address.bech32, nonce });

    const signature = Ed25519.sign(
      address.keyPair.privateKey,
      Converter.utf8ToBytes(`0x${toHex(nonce)}`),
    );

    const wallet2 = await WalletService.newWallet(
      network === Network.SMR ? Network.RMS : Network.SMR,
    );
    const secondAddress = await wallet2.getNewIotaAddressDetails();
    const request = {
      address: 'address',
      signature: Converter.bytesToHex(signature),
      publicKey: {
        hex: Converter.bytesToHex(secondAddress.keyPair.publicKey),
        network,
      },
      body: {},
    };
    try {
      await decodeAuth(request, WEN_FUNC.approveProposal);
      fail();
    } catch (error: any) {
      expect(error.details.key).toBe(WenError.failed_to_decode_token.key);
    }
  });

  it('Should update nonce when public key sign in', async () => {
    const wallet = await WalletService.newWallet(Network.RMS);
    const address = await wallet.getNewIotaAddressDetails();

    const nonce = getRandomNonce();
    const userDocRef = build5Db().doc(`${COL.MEMBER}/${address.bech32}`);
    await userDocRef.create({ uid: address.bech32, nonce });

    const signature = Ed25519.sign(
      address.keyPair.privateKey,
      Converter.utf8ToBytes(`0x${toHex(nonce)}`),
    );
    const request = {
      address: 'address',
      signature: Converter.bytesToHex(signature),
      publicKey: {
        hex: Converter.bytesToHex(address.keyPair.publicKey),
        network: Network.RMS,
      },
      body: {},
    };

    const result = await decodeAuth(request, WEN_FUNC.approveProposal);

    expect(result.address).toBe(address.bech32);

    const user = <Member>await userDocRef.get();
    expect(user.validatedAddress![Network.RMS]).toBe(address.bech32);
    expect(user.nonce).not.toBe(nonce);
  });

  it('Should update nonce when metamask sign in', async () => {
    const address = wallet.getRandomEthAddress();

    const nonce = getRandomNonce();
    const userDocRef = build5Db().doc(`${COL.MEMBER}/${address}`);
    await userDocRef.create({ uid: address, nonce });

    const recoverPersonalSignatureMock = recoverPersonalSignature as jest.Mock;
    recoverPersonalSignatureMock.mockReturnValue(address);

    const request = {
      address,
      signature: 'signature',
      body: {},
    };

    const result = await decodeAuth(request, WEN_FUNC.approveProposal);
    expect(result.address).toBe(address);

    const user = await userDocRef.get<Member>();
    expect(user?.nonce).not.toBe(nonce);

    recoverPersonalSignatureMock.mockRestore();
  });

  it('Should throw with metamask sign in, wrong signature', async () => {
    const address = wallet.getRandomEthAddress();

    const nonce = getRandomNonce();
    const userDocRef = build5Db().doc(`${COL.MEMBER}/${address}`);
    await userDocRef.create({ uid: address, nonce });

    const request = {
      address,
      signature: 'signature',
      body: {},
    };
    try {
      await decodeAuth(request, WEN_FUNC.approveProposal);
      fail();
    } catch (error: any) {
      expect(error.details.key).toBe(WenError.invalid_signature.key);
    }
  });
});

const toHex = (stringToConvert: string) =>
  stringToConvert
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
