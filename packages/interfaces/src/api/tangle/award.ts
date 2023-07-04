import { EthAddress, IotaAddress, NativeToken } from '../../models';
import {
  ApiError,
  AwardApproveParticipantRequest,
  AwardCreateRequest,
  AwardFundRequest,
} from '../post';

export type AwardApproveParticipantTangleRequest = AwardApproveParticipantRequest;

export interface AwardApproveParticipantTangleResponse {
  badges: { [key: string]: string };
  errors: { [key: string]: ApiError };
}

export type AwardCreateTangleRequest = AwardCreateRequest;

export interface AwardCreateTangleResponse {
  award: EthAddress;
  amount: number;
  address: IotaAddress;
  nativeTokens?: NativeToken[];
}

export type AwardFundTangleRequest = AwardFundRequest;
