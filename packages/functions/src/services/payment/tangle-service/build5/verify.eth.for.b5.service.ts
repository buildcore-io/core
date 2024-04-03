import { build5Db } from '@build-5/database';
import { COL, SoonSnap, TangleResponse } from '@build-5/interfaces';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { verifyEthForB5TangleSchema } from './VerifyEthForB5TangleRequest';

export class VerifyEthForBuil5TangleService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ request, match }: HandlerParams): Promise<TangleResponse> => {
    const params = await assertValidationAsync(verifyEthForB5TangleSchema, request);
    const ethAddress = params.ethAddress;

    let soonSnapDocRef = build5Db().doc(`${COL.SOON_SNAP}/${match.from}`);
    let soonSnap = await this.transaction.get<SoonSnap>(soonSnapDocRef);
    if (!soonSnap) {
      soonSnapDocRef = build5Db().doc(`${COL.SOON_SNAP}/${ethAddress}`);
      soonSnap = await this.transaction.get<SoonSnap>(soonSnapDocRef);
    }

    if (soonSnap && !soonSnap.ethAddressVerified) {
      this.transactionService.push({
        ref: soonSnapDocRef,
        data: {
          ethAddress: soonSnap.ethAddress || ethAddress,
          ethAddressVerified: true,
        },
        action: 'update',
      });
    }

    return { status: 'success' };
  };
}
