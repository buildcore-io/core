import { EthAddress } from '@build-5/interfaces';
import { CommonJoi } from '../../services/joi/common';

export interface UidSchemaObject {
  uid: EthAddress;
}
export const uidSchema = { uid: CommonJoi.uid() };
