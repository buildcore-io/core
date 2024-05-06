import { Member, Network } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgMember } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class MemberConverter implements Converter<Member, PgMember> {
  toPg = (member: Member): PgMember => ({
    uid: member.uid,
    project: member.project,
    createdOn: member.createdOn?.toDate(),
    updatedOn: member.updatedOn?.toDate(),
    createdBy: member.createdBy,
    nonce: member.nonce,
    name: member.name,
    about: member.about,
    avatarNft: member.avatarNft,
    avatar: member.avatar,
    discord: member.discord,
    twitter: member.twitter,
    github: member.github,

    smrAddress: (member.validatedAddress || {})[Network.SMR],
    rmsAddress: (member.validatedAddress || {})[Network.RMS],
    iotaAddress: (member.validatedAddress || {})[Network.IOTA],
    atoiAddress: (member.validatedAddress || {})[Network.ATOI],

    prevValidatedAddresses: member.prevValidatedAddresses,
    tokenTradingFeePercentage: member.tokenTradingFeePercentage,
    tokenPurchaseFeePercentage: member.tokenPurchaseFeePercentage,
    awardsCompleted: member.awardsCompleted,

    spaces: member.spaces,
  });

  fromPg = (member: PgMember): Member =>
    removeNulls({
      uid: member.uid,
      project: member.project || '',
      createdOn: pgDateToTimestamp(member.createdOn),
      updatedOn: pgDateToTimestamp(member.updatedOn),
      createdBy: member.createdBy || '',
      nonce: member.nonce || '',
      name: member.name || '',
      about: member.about || '',
      avatarNft: member.avatarNft || '',
      avatar: member.avatar || '',
      discord: member.discord || '',
      twitter: member.twitter || '',
      github: member.github || '',

      validatedAddress: {
        [Network.SMR]: member.smrAddress || '',
        [Network.RMS]: member.rmsAddress || '',
        [Network.IOTA]: member.iotaAddress || '',
        [Network.ATOI]: member.atoiAddress || '',
      },

      prevValidatedAddresses: member.prevValidatedAddresses,

      spaces: member.spaces as any,

      tokenTradingFeePercentage: member.tokenTradingFeePercentage,
      tokenPurchaseFeePercentage: member.tokenPurchaseFeePercentage,
      awardsCompleted: member.awardsCompleted,
    });
}
