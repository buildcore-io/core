import { database } from '@buildcore/database';
import { COL, TangleResponse } from '@buildcore/interfaces';
import axios from 'axios';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { verifyEthForB5TangleSchema } from './VerifyEthForB5TangleRequest';

export class VerifyEthForBuilTokenTangleService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ request, match }: HandlerParams): Promise<TangleResponse> => {
    const params = await assertValidationAsync(verifyEthForB5TangleSchema, request);
    let ethAddress = params.ethAddress.toLowerCase();

    let soonSnapDocRef = database().doc(COL.SOON_SNAP, match.from);
    let soonSnap = await this.transaction.get(soonSnapDocRef);
    if (!soonSnap) {
      soonSnapDocRef = database().doc(COL.SOON_SNAP, ethAddress);
      soonSnap = await this.transaction.get(soonSnapDocRef);
    }

    ethAddress = soonSnap?.ethAddress || ethAddress;

    if (!(await isFollowerOfJustBuild(ethAddress))) {
      return { status: 'error', message: 'Must follow JustBuild' };
    }

    if (!soonSnap) {
      return { status: 'error', message: 'No snapshot for this SMR address' };
    }

    if (!soonSnap.ethAddressVerified) {
      this.transactionService.push({
        ref: soonSnapDocRef,
        data: { ethAddress, ethAddressVerified: true },
        action: Action.U,
      });
    }

    return { status: 'success' };
  };
}

const JUST_BUILD_FID = '414955';
const NEYNAR_API_KEY = '66806C32-DF58-4DA9-9607-A343BA597C55';

const isFollowerOfJustBuild = async (ethAddress: string) => {
  const fid = await axios(`https://api.neynar.com/v2/farcaster/user/bulk-by-address`, {
    params: { addresses: ethAddress },
    headers: { api_key: NEYNAR_API_KEY },
  }).then((r) => r.data[ethAddress]?.[0]?.fid);

  return axios(`https://api.neynar.com/v2/farcaster/user/bulk`, {
    params: { fids: fid, viewer_fid: JUST_BUILD_FID },
    headers: { api_key: NEYNAR_API_KEY },
  })
    .then((r) => !!r.data.users[0]?.viewer_context?.followed_by)
    .catch(() => false);
};