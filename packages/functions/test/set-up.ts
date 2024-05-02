require('dotenv').config({ path: (__dirname + '/.env').replace('test/', '') });
import { database } from '@buildcore/database';
import {
  COL,
  Network,
  SOON_PROJECT_ID,
  SendToManyTargets,
  Space,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { CoinType, utf8ToHex } from '@iota/sdk';
import axios from 'axios';
import { generateCustomTokenControl } from '../src/controls/auth/auth.control';
import { Context } from '../src/controls/common';
import { createMemberControl } from '../src/controls/member/member.create';
import { MnemonicService } from '../src/services/wallet/mnemonic';
import { Wallet, WalletParams } from '../src/services/wallet/wallet';
import { AddressDetails, WalletService } from '../src/services/wallet/wallet.service';
import { getSecretManager } from '../src/utils/secret.manager.utils';
import { getRandomEthAddress } from '../src/utils/wallet.utils';

const tokens: { [key: string]: string } = {};

export const PROJECT_API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNjk5MjgyMTQxfQ.Bd0IZNdtc3ne--CC1Bk5qDgWl4NojAsX64K1rCj-5Co';

const mockk = {
  address: '',
  body: {} as any,
  token: undefined as string | undefined,
  projectApiKey: PROJECT_API_KEY,
};

export const mockWalletReturnValue = (
  address: string,
  body: any,
  token?: string,
  projectApiKey?: string,
) => {
  mockk.address = address;
  mockk.body = body;
  mockk.token = token;
  mockk.projectApiKey = projectApiKey !== undefined ? projectApiKey : PROJECT_API_KEY;
};

export const testEnv = {
  wrap: async <T>(func: WEN_FUNC) => {
    try {
      let request = {
        address: mockk.address,
        projectApiKey: mockk.projectApiKey,
        signature: '',
        publicKey: {},
        customToken: mockk.token || tokens[mockk.address],
        body: mockk.body || {},
      };
      if (!request.customToken) {
        const memberDocRef = database().doc(COL.MEMBER, mockk.address);
        const member = await memberDocRef.get();
        const mnemonic = await MnemonicService.get(mockk.address);
        const secretManager = getSecretManager(mnemonic);
        const signature = await secretManager.signEd25519(utf8ToHex(member?.nonce!), {
          coinType: CoinType.IOTA,
        });
        request = {
          address: mockk.address,
          projectApiKey: mockk.projectApiKey,
          signature: signature.signature,
          publicKey: { hex: signature.publicKey, network: Network.RMS },
          customToken: '',
          body: mockk.body || {},
        };
      }
      const payload = JSON.stringify(request, (_key, value) =>
        value === undefined ? null : value,
      );
      const response = await axios.post('http://localhost:8080/' + func, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      return response.data as T;
    } catch (err: any) {
      if (err.response?.data) {
        throw err.response?.data;
      }
      throw err;
    }
  },

  mockWrap: async <T>(func: (context: Context<any>) => Promise<any>) => {
    const request = {
      ip: '127.0.0.1',
      owner: mockk.address,
      params: mockk.body || {},
      project: SOON_PROJECT_ID,
      headers: {},
      rawBody: {},
    };
    return (await func(request)) as T;
  },

  createMember: async () => {
    const owner = getRandomEthAddress();
    mockWalletReturnValue(owner, undefined);
    await testEnv.mockWrap(createMemberControl);
    mockWalletReturnValue(owner, undefined);
    const token = await testEnv.mockWrap<string>(generateCustomTokenControl);
    tokens[owner] = token;
    const addresses = {} as any;
    const promises = Object.values(Network).map(async (network) => {
      const wallet = await getWallet(network);
      const address = await wallet.getNewIotaAddressDetails();
      addresses[`${network}Address`] = address.bech32;
    });
    await Promise.all(promises);
    await database().doc(COL.MEMBER, owner).update(addresses);
    return owner;
  },

  createSpace: async (member: string) => {
    mockWalletReturnValue(member, { name: 'Space A', bannerUrl: MEDIA });
    const space = await testEnv.wrap<Space>(WEN_FUNC.createSpace);

    const addresses = {} as any;
    const promises = Object.values(Network).map(async (network) => {
      const wallet = await getWallet(network);
      const address = await wallet.getNewIotaAddressDetails();
      addresses[`${network}Address`] = address.bech32;
    });
    await Promise.all(promises);
    await database().doc(COL.SPACE, space.uid).update(addresses);
    return (await database().doc(COL.SPACE, space.uid).get())!;
  },

  createBlock: async (blockId: string) => {
    await database().getCon()('blocks').insert({ blockId });
  },
};

export const wallets: { [key: string]: Wallet } = {};

class TestWallet extends Wallet {
  constructor(private readonly wallet: Wallet) {
    super(wallet.client, wallet.info, wallet.nodeIndex, wallet.nodeUrl, wallet.network);
  }

  public getBalance = this.wallet.getBalance;
  public getNewIotaAddressDetails = this.wallet.getNewIotaAddressDetails;
  public getIotaAddressDetails = this.wallet.getIotaAddressDetails;
  public getAddressDetails = this.wallet.getAddressDetails;
  public bechAddressFromOutput = this.wallet.bechAddressFromOutput;
  public getOutputs = this.wallet.getOutputs;
  public creditLocked = this.wallet.creditLocked;

  public send = async (
    from: AddressDetails,
    toAddress: string,
    amount: number,
    params: WalletParams,
    outputToConsume?: string | undefined,
  ) => {
    const blockId = await this.wallet.send(from, toAddress, amount, params, outputToConsume);
    await database().getCon()('blocks').insert({ blockId });
    return blockId;
  };

  public sendToMany = async (
    from: AddressDetails,
    targets: SendToManyTargets[],
    params: WalletParams,
  ) => {
    const blockId = await this.wallet.sendToMany(from, targets, params);
    await database().getCon()('blocks').insert({ blockId });
    return blockId;
  };
}

export const getWallet = async (network: Network) => {
  const wallet = wallets[network];
  if (!wallet) {
    const baseWallet = await WalletService.newWallet(network);
    wallets[network] = new TestWallet(baseWallet);
  }
  return wallets[network];
};

export const MEDIA =
  'https://images-wen.soonaverse.com/0x0275dfc7c2624c0111d441a0819dccfd5e947c89%2F6stvhnutvg%2Ftoken_introductionary';
export const SOON_PROJ_GUARDIAN = '0x3d5d0b3f40c9438871b1c43d6b70117eeff77ad8';
export const soonTokenId = '0xa381bfccaf121e38e31362d85b5ad30cd7fc0d06';
export const rmsTokenId = '0x52f27a34170900537acb61e5ff0fe94a2841ff52';
export const atoiTokenId = '0x9c119bd60f7cadf3406c43cead6c8723012bca27';
