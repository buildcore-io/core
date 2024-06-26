import { OtrWrapper } from './otr';

export const otr = (otrAddress: string = SoonaverseOtrAddress.SHIMMER) =>
  new OtrWrapper(otrAddress);

/**
 * Soonaverse OTR Addresses per chain.
 */
export enum SoonaverseOtrAddress {
  IOTA = 'iota1qpwxxaw6fw8zeezefyqf0y7hnrpkcmfa4afc67ywfkpp3gwj0ttzcexhvan',
  SHIMMER = 'smr1qp0248uakdvfrhyr58yk5lswhnt033vrhst2j4c77laepdv2rk0psgh4t4x',
  TEST = 'rms1qp29ma9mugkrlaq9e60pmdray4sn2zjpet4vyk86cezm0jqpdwuhv68j3vh',
}
