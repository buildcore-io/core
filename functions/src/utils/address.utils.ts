import { WenError } from "../../interfaces/errors";
import { Network } from "../../interfaces/models";
import { ValidatedAddress } from "../../interfaces/models/base";
import { throwInvalidArgument } from "./error.utils";

export const assertMemberHasValidAddress = (address: ValidatedAddress | undefined, network = Network.IOTA) => {
  if (!address || !address[network]) {
    throw throwInvalidArgument(WenError.member_must_have_validated_address)
  }
}

export const assertSpaceHasValidAddress = (address: ValidatedAddress | undefined, network = Network.IOTA) => {
  if (!address || !address[network]) {
    throw throwInvalidArgument(WenError.space_must_have_validated_address)
  }
}

export const getAddress = (address: ValidatedAddress | undefined, network = Network.IOTA) => address ? (address[network] || '') : ''

