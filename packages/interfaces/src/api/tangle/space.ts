import { EthAddress } from '../../models';
import {
  SpaceCreateRequest,
  SpaceJoinRequest,
  SpaceLeaveRequest,
  SpaceMemberUpsertRequest,
} from '../post';

export type SpaceCreateTangleRequest = SpaceCreateRequest;

export type SpaceMemberUpsertTangleRequest = SpaceMemberUpsertRequest;

export interface SpaceGuardianUpsertTangleResponse {
  proposal: EthAddress;
}

export type SpaceLeaveTangleRequest = SpaceLeaveRequest;

export type SpaceJoinTangleRequest = SpaceJoinRequest;
