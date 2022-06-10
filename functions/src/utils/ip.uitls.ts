import * as functions from 'firebase-functions';
import IPinfoWrapper from "node-ipinfo";
import { WenError } from "../../interfaces/errors";
import { throwInvalidArgument } from "./error.utils";
/**
 * Key value pair for blocked country codes
 * key - any entity id (nft id, token id, etc). Default key is 'default'.
 * value - country codes
 */
export const BLOCKED_COUNTRIES = (functions.config()?.blocked_countries || {}) as { [key: string]: string[] }

export const IP_INFO_TOKEN = functions.config()?.ip_info?.token || ''

export const assertIpNotBlocked = async (ipAddress: string, entityId = '', ipInfoToken = IP_INFO_TOKEN, blockedCountries = BLOCKED_COUNTRIES) => {
  const ipInfoWrapper = new IPinfoWrapper(ipInfoToken);
  const info = await ipInfoWrapper.lookupIp(ipAddress)
  const blockedCountryCodes = blockedCountries[entityId || 'default'] || [];
  if (blockedCountryCodes.includes(info.countryCode) || info.privacy.vpn) {
    throw throwInvalidArgument(WenError.blocked_country)
  }
}
