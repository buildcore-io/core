import { database } from '@buildcore/database';
import { COL, TangleResponse } from '@buildcore/interfaces';
import axios from 'axios';
import { logger } from '../../../../utils/logger';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { verifyEthForB5TangleSchema } from './VerifyEthForB5TangleRequest';

export class VerifyEthForBuilTokenTangleService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ request, match }: HandlerParams): Promise<TangleResponse> => {
    const params = await assertValidationAsync(verifyEthForB5TangleSchema, request);
    const ethAddresses = params.ethAddress.toLowerCase().split(',');

    const fid = await getFidForEth(ethAddresses[0]);
    if (!(await isUserFollowingChannel(fid))) {
      return { status: 'error', message: 'Must follow JustBuild' };
    }

    await this.confirmEthAddress(match.from, ethAddresses[0]);

    for (const ethAddress of ethAddresses) {
      await this.confirmEthAddress(ethAddress, ethAddress);
    }

    return { status: 'success' };
  };

  private confirmEthAddress = async (soonSnapUid: string, ethAddress: string) => {
    const soonSnapDocRef = database().doc(COL.SOON_SNAP, soonSnapUid);
    const soonSnap = await this.transaction.get(soonSnapDocRef);
    if (soonSnap && !soonSnap.ethAddressVerified) {
      this.transactionService.push({
        ref: soonSnapDocRef,
        data: { ethAddress, ethAddressVerified: true },
        action: Action.U,
      });
    }
  };
}

const getFidForEth = async (ethAddress: string) =>
  axios(`https://api.neynar.com/v2/farcaster/user/bulk-by-address`, {
    params: { addresses: ethAddress },
    headers: { api_key: process.env.NEYNAR_API_KEY },
  })
    .then((r) => r.data[ethAddress]?.[0]?.fid)
    .catch((error) => {
      logger.error('getFidForEth', error);
      return 0;
    });

const isUserFollowingChannel = async (fid: number) =>
  fetch(`https://api.neynar.com/v2/farcaster/channel?id=justbuild&viewer_fid=${fid}`, {
    headers: { api_key: process.env.NEYNAR_API_KEY! },
  })
    .then((r) => r.json())
    .then((obj) => !!obj?.channel?.viewer_context?.following)
    .catch(() => false);
