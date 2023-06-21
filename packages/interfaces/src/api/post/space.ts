import { EthAddress } from '../../models';

export interface SpaceCreateRequest {
  name?: string | null;
  about?: string | null;
  open?: boolean;
  discord?: string | null;
  github?: string | null;
  twitter?: string | null;
  avatarUrl?: string;
  bannerUrl?: string;
}

export interface SpaceMemberUpsertRequest {
  uid: EthAddress;
  member: EthAddress;
}

export interface SpaceUpdateRequest extends SpaceCreateRequest {
  uid: EthAddress;
  tokenBased: boolean;
  minStakedValue?: number;
}

export interface SpaceLeaveRequest {
  uid: EthAddress;
}

export type SpaceJoinRequest = SpaceLeaveRequest;

export type SpaceClaimRequest = SpaceLeaveRequest;
