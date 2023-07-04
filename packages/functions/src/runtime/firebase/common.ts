import { EthAddress } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export interface UidSchemaObject {
  uid: EthAddress;
}
export const uidSchema = { uid: CommonJoi.uid() };

export const uidSchemaObj = toJoiObject<UidSchemaObject>(uidSchema);
