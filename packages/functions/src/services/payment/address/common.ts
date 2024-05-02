import { IDocument, PgSpaceUpdate, database } from '@buildcore/database';
import { COL, DEFAULT_NETWORK, Entity, Transaction } from '@buildcore/interfaces';
import { getAddress } from '../../../utils/address.utils';
import { BaseService } from '../base';
import { Action } from '../transaction-service';

export abstract class BaseAddressService extends BaseService {
  protected async setValidatedAddress(credit: Transaction, type: Entity): Promise<void> {
    const collection = type === Entity.MEMBER ? COL.MEMBER : COL.SPACE;
    const id = type === Entity.MEMBER ? credit.member! : credit.space!;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ref: IDocument<any, any, PgSpaceUpdate> = database().doc(collection, id);

    const docData = await this.transaction.get(ref);
    const network = credit.network || DEFAULT_NETWORK;
    const currentAddress = getAddress(docData, network);

    const data = currentAddress
      ? {
          [`${network}Address`]: credit.payload.targetAddress,
          prevValidatedAddresses: database().arrayUnion(currentAddress),
        }
      : { [`${network}Address`]: credit.payload.targetAddress };

    this.transactionService.push({ ref, data, action: Action.U });
  }
}
