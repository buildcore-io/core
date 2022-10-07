
export const SYSTEM_CONFIG_DOC_ID = 'config'

export interface SystemConfig {
  readonly tokenTradingFeePercentage?: number;
  readonly tokenPurchaseFeePercentage?: number;
}
