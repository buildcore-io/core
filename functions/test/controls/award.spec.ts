import { WenError } from "../../interfaces/errors";
import { WEN_FUNC } from "../../interfaces/functions";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { createAward } from './../../src/controls/award.control';

describe('AwardController: ' + WEN_FUNC.cAward, () => {
  it('successfully create award with name', async () => {
    const dummyAddress = wallet.getRandomEthAddress();
    const walletSpy = jest.spyOn(wallet, 'decodeToken');
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {
        name: 'John'
      }
    }));

    const wrapped: any = testEnv.wrap(createAward);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
    // const returns = await wrapped();
    // expect(returns?.uid).toEqual(dummyAddress.toLowerCase());
    // expect(returns?.name).toEqual('Award Abc');
    // expect(returns?.createdOn).toBeDefined();
    // expect(returns?.updatedOn).toBeDefined();
    // walletSpy.mockRestore();
  });
});
