import { EthAddress } from '../../models';

export interface CreateMemberRequest {
  address: EthAddress;
}

export interface MemberUpdateRequest {
  name?: string | null;
  about?: string | null;
  discord?: string | null;
  github?: string | null;
  twitter?: string | null;
  avatarNft?: EthAddress | null;
  avatar?: EthAddress | null;
}
