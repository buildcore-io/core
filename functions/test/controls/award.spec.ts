import { WEN_FUNC } from "../../interfaces/functions";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { WenError } from './../../interfaces/errors';
import { createAward } from './../../src/controls/award.control';
import { createMember } from './../../src/controls/member.control';
import { createSpace } from './../../src/controls/space.control';

describe('AwardController: ' + WEN_FUNC.cAward, () => {
  let walletSpy: any;
  let memberAddress: any;
  let space: any;
  const exampleCid = 'bagaaierasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea';

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeToken');
    memberAddress = wallet.getRandomEthAddress();
    walletSpy.mockReturnValue(Promise.resolve({
      address: memberAddress,
      body: {
        name: 'John'
      }
    }));

    const wrapped: any = testEnv.wrap(createMember);
    const returns = await wrapped();
    expect(returns?.uid).toEqual(memberAddress.toLowerCase());
    expect(returns?.name).toEqual('John');
    walletSpy.mockReturnValue(Promise.resolve({
      address: memberAddress,
      body: {
        name: 'Space A'
      }
    }));
    const wCreate: any = testEnv.wrap(createSpace);
    space = await wCreate();
    expect(space?.uid).toBeDefined();
    walletSpy.mockRestore();
  });

  it('successfully create award with name', async () => {
    const walletSpy = jest.spyOn(wallet, 'decodeToken');
    const body: any = {
      name: 'Award A',
      description: 'Finish this and that',
      space: space?.uid,
      badge: {
        name: 'Winner',
        ipfsCid: exampleCid,
        description: 'Such a special',
        count: 2,
        xp: 0
      }
    };
    walletSpy.mockReturnValue(Promise.resolve({
      address: memberAddress,
      body: body
    }));

    const wrapped: any = testEnv.wrap(createAward);
    const returns = await wrapped();
    expect(returns?.uid).toBeDefined();
    expect(returns?.name).toEqual(body.name);
    expect(returns?.description).toEqual(body.description);
    expect(returns?.space).toEqual(body.space);
    expect(returns?.badge).toEqual(body.badge);
    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  describe('Failed Validation', () => {
    let body: any;
    let walletSpy: any;
    beforeEach(async () => {
      walletSpy = jest.spyOn(wallet, 'decodeToken');
      body = {
        name: 'Award A',
        description: 'Finish this and that',
        space: space?.uid,
        badge: {
          name: 'Winner',
          ipfsCid: exampleCid,
          description: 'Such a special',
          count: 2,
          xp: 0
        }
      };
    });

    it('failed to create award - wrong IPFS for badge', async () => {
      delete body.badge.ipfsCid;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
      walletSpy.mockRestore();
    });

    it('failed to create award - missing space', async () => {
      delete body.space;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
      walletSpy.mockRestore();
    });

    it('failed to create award - invalid space', async () => {
      body.space = wallet.getRandomEthAddress();
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.space_does_not_exists.key);
      walletSpy.mockRestore();
    });

    it('failed to create award - invalid name', async () => {
      delete body.name;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
      walletSpy.mockRestore();
    });

    it('failed to create award - badge over limit', async () => {
      body.badge.count = 1001;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
      walletSpy.mockRestore();
    });

    it('failed to create award - badge over XP limit', async () => {
      body.badge.count = 1001;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
      walletSpy.mockRestore();
    });
  });
});
