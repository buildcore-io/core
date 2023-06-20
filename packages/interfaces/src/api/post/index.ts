export * from './address';
export * from './award';
export * from './collection';
export * from './credit.unrefundable';
export * from './member';
export * from './nft';
export * from './proposal';
export * from './rank';
export * from './space';
export * from './stake';
export * from './token';
export * from './vote';

export interface ApiError {
  code: number;
  message: string;
}
