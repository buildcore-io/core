import { EthAddress } from '../models/base';
export const enum WEN_FUNCTIONS {
  CREATE_MEMBER_IF_NOT_EXISTS = "CREATE_MEMBER_IF_NOT_EXISTS",
  UPDATE_MEMBER_IF_NOT_EXISTS = "UPDATE_MEMBER_IF_NOT_EXISTS"
}

export interface CREATE_MEMBER_IF_NOT_EXISTS {
  address: EthAddress;
}
