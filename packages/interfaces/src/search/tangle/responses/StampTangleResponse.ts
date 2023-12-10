import { TangleResponse } from './TangleResponse';

export interface StampCreateTangleResponse extends TangleResponse {
  dailyCost: number;
  stamp: string;
  amountToMint: number;
}
