import * as functions from 'firebase-functions';
import IPinfoWrapper from "node-ipinfo";
import { WenError } from "../../interfaces/errors";
import { throwInvalidArgument } from "./error.utils";
/**
 * Key value pair for blocked country codes
 * key - any entity id (nft id, token id, etc). Default key is 'default'.
 * value - country codes
 */
export const getBlockedCountries = () => (functions.config()?.blocked_countries || {}) as { [key: string]: string[] }

export const getIpInfoToken = () => functions.config()?.ip_info?.token || ''

export const getIpInfo = (ipInfoToken: string, ipAddress: string) => new IPinfoWrapper(ipInfoToken).lookupIp(ipAddress)

export const assertIpNotBlocked = async (ipAddress: string, entityId = '', ipInfoToken = getIpInfoToken(), blockedCountries = getBlockedCountries()) => {
  const ipInfo = await getIpInfo(ipInfoToken, ipAddress)
  const blockedCountryCodes = blockedCountries[entityId] || blockedCountries.default || [];
  if (blockedCountryCodes.includes(ipInfo.countryCode) || ipInfo.privacy.vpn) {
    throw throwInvalidArgument(WenError.blocked_country)
  }
}
