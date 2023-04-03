import { BLOCKED_COUNTRIES, WenError } from '@soonaverse/interfaces';
import IPinfoWrapper from 'node-ipinfo';
import { throwInvalidArgument } from './error.utils';
/**
 * Key value pair for blocked country codes
 * key - any entity id (nft id, token id, etc). Default key is 'default'.
 * value - country codes
 */
export const getBlockedCountries = () => (BLOCKED_COUNTRIES || {}) as { [key: string]: string[] };

export const getIpInfoToken = () => process.env.IP_INFO_TOKEN || '';

export const getIpInfo = (ipInfoToken: string, ipAddress: string) =>
  new IPinfoWrapper(ipInfoToken).lookupIp(ipAddress);

const getBlockedCountriesForEntity = (
  blockedCountries: { [key: string]: string[] },
  entityId: string,
  entityType: 'token' | 'nft',
) => {
  const forEntityId = blockedCountries[entityId];
  if (forEntityId) {
    return forEntityId;
  }
  const common = blockedCountries.common || [];
  const forEntityType = blockedCountries[entityType] || [];
  return [...common, ...forEntityType];
};

export const assertIpNotBlocked = async (
  ipAddress: string,
  entityId = '',
  entityType: 'token' | 'nft',
  ipInfoToken = getIpInfoToken(),
  blockedCountries = getBlockedCountries(),
) => {
  const ipInfo = await getIpInfo(ipInfoToken, ipAddress);
  const blockedCountryCodes = getBlockedCountriesForEntity(blockedCountries, entityId, entityType);
  if (blockedCountryCodes.includes(ipInfo.countryCode)) {
    throw throwInvalidArgument(WenError.blocked_country);
  }
};
