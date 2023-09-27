import { build5Db } from '@build-5/database';
import { COL, DEFAULT_NETWORK, Entity, Transaction } from '@build-5/interfaces';
import { getAddress } from '../../../utils/address.utils';
import { BaseService } from '../base';

export abstract class BaseAddressService extends BaseService {
  protected async setValidatedAddress(credit: Transaction, type: Entity): Promise<void> {
    const collection = type === Entity.MEMBER ? COL.MEMBER : COL.SPACE;
    const id = type === Entity.MEMBER ? credit.member : credit.space;
    const ref = build5Db().doc(`${collection}/${id}`);
    const docData = await ref.get<Record<string, unknown>>();
    const network = credit.network || DEFAULT_NETWORK;
    const currentAddress = getAddress(docData, network);
    const data = { [`validatedAddress.${network}`]: credit.payload.targetAddress };
    if (currentAddress) {
      data.prevValidatedAddresses = build5Db().arrayUnion(currentAddress);
    }
    this.transactionService.push({ ref, data, action: 'update' });
  }
}
