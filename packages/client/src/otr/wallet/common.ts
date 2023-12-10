import { INativeToken } from '@iota/sdk';

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
  tag: string;
}
