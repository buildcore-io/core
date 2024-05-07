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

    const fid = await getFidForEth(ethAddress);
    if (!(await isUserFollowingChannel(fid))) {
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

const getFidForEth = async (ethAddress: string) =>
  axios(`https://api.neynar.com/v2/farcaster/user/bulk-by-address`, {
    params: { addresses: ethAddress },
    headers: { api_key: process.env.NEYNAR_API_KEY },
  }).then((r) => r.data[ethAddress]?.[0]?.fid);

const isUserFollowingChannel = async (fid: number) =>
  fetch(`https://api.neynar.com/v2/farcaster/channel?id=justbuild&viewer_fid=${fid}`, {
    headers: { api_key: process.env.NEYNAR_API_KEY! },
  })
    .then((r) => r.json())
    .then((obj) => !!obj?.channel?.viewer_context?.following)
    .catch(() => false);
