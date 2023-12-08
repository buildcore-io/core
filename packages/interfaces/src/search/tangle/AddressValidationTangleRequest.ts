/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Tangle request object to validate an address.
 */
export interface AddressValidationTangleRequest {
  /**
   * Type of the tangle request.
   */
  requestType: 'ADDRESS_VALIDATION';
  /**
   * Build5 id of the space
   */
  space?: string;
}