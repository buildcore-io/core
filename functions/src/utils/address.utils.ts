import { WenError } from '../../interfaces/errors';
import { Member, Network, Space } from '../../interfaces/models';
import { ValidatedAddress } from '../../interfaces/models/base';
import { throwInvalidArgument } from './error.utils';

export const assertMemberHasValidAddress = (member: Member | undefined, network: Network) => {
  if (!member?.validatedAddress || !member.validatedAddress[network]) {
    throw throwInvalidArgument(WenError.member_must_have_validated_address);
  }
};

export const assertSpaceHasValidAddress = (space: Space | undefined, network: Network) => {
  if (!space?.validatedAddress || !space.validatedAddress[network]) {
    throw throwInvalidArgument(WenError.space_must_have_validated_address);
  }
};

export const getAddress = <T extends { validatedAddress?: ValidatedAddress }>(
  entity: T | undefined,
  network: Network,
) => (entity?.validatedAddress || {})[network] || '';
