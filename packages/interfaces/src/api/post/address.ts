import { Network } from '../../models';

/**
 * Http request to create an address validation order.
 * Endpoint to call: api/validateaddress
 */
export interface AddressValidationRequest {
  /**
   * Creates an address validation order for the given space.
   * If undefined the address validation order will be created for the member
   */
  space?: string;
  /**
   * Specified the network for validatin an address.
   * If undefined will default to IOTA
   */
  network?: Network;
}
