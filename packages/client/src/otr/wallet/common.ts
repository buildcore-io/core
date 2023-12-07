import { INativeToken } from '@iota/sdk';
export const TAG = 'build5-client';

export interface AddressDetails {
  bech32: string;
  hex: string;
  mnemonic: string;
}

export interface WalletPrams {
  targetAddress: string;
  amount?: number;
  nativeTokens?: INativeToken;
  metadata: Record<string, unknown>;
}
