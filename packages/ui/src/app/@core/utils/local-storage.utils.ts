export enum StorageItem {
  Auth = 'App/auth',
  AuthAddress = 'App/authAddress',
  Theme = 'App/theme',
  StakingDetails = 'App/stakingDetails',
  VerificationTransaction = 'App/verificationTransaction',
  CheckoutTransaction = 'App/checkoutTransaction',
  Notification = 'App/notification-',
  BidTransaction = 'App/bidTransaction-',
  TokenMintTransaction = 'App/tokenMintTransaction-',
  TokenAirdropTransaction = 'App/tokenAirdropTransaction-',
  CollectionMintTransaction = 'App/collectionMintTransaction-',
  CollectionMigrationWarningClosed = 'App/collectionMigrationWarningClosed',
  TokenClaimTransaction = 'App/tokenClaimTransaction-',
  TokenStakeTransaction = 'App/tokenStakeTransaction-',
  LockedTokenClaimTransaction = 'App/lockedTokenClaimTransaction-',
  TokenMigrationWarningClosed = 'App/tokenMigrationWarningClosed',
  NotMintedTokensWarningClosed = 'App/notMintedTokensWarningClosed',
  FavouriteTokens = 'App/favouriteTokens',
  TokenBidsAcceptedTerms = 'App/tokenBidsAcceptedTerms',
  TokenOffersAcceptedTerms = 'App/tokenOffersAcceptedTerms',
  SelectedTradePriceOption = 'App/selectedTradePriceOption',
  DepositNftTransaction = 'App/depositNftTransaction-',
}

export const getBitItemItem = (nftId: string): unknown | null => {
  const item = localStorage.getItem(StorageItem.BidTransaction + nftId);
  return item ? JSON.parse(item) : null;
};

export const setBitItemItem = (nftId: string, value: unknown): void => {
  localStorage.setItem(StorageItem.BidTransaction + nftId, JSON.stringify(value));
};

export const removeBitItemItem = (nftId: string): void => {
  localStorage.removeItem(StorageItem.BidTransaction + nftId);
};

export const getTokenClaimItem = (tokenId: string): unknown | null => {
  const item = localStorage.getItem(StorageItem.TokenClaimTransaction + tokenId);
  return item ? JSON.parse(item) : null;
};

export const setTokenClaimItem = (tokenId: string, value: unknown): void => {
  localStorage.setItem(StorageItem.TokenClaimTransaction + tokenId, JSON.stringify(value));
};

export const removeTokenClaimItem = (tokenId: string): void => {
  localStorage.removeItem(StorageItem.TokenClaimTransaction + tokenId);
};

export const getTokenStakeItem = (tokenId: string): unknown | null => {
  const item = localStorage.getItem(StorageItem.TokenStakeTransaction + tokenId);
  return item ? JSON.parse(item) : null;
};

export const setTokenStakeItem = (tokenId: string, value: unknown): void => {
  localStorage.setItem(StorageItem.TokenStakeTransaction + tokenId, JSON.stringify(value));
};

export const removeStakeTokenItem = (tokenId: string): void => {
  localStorage.removeItem(StorageItem.TokenStakeTransaction + tokenId);
};

export const getLockedTokenClaimItem = (transactionId: string): unknown | null => {
  const item = localStorage.getItem(StorageItem.LockedTokenClaimTransaction + transactionId);
  return item ? JSON.parse(item) : null;
};

export const setLockedTokenClaimItem = (transactionId: string, value: unknown): void => {
  localStorage.setItem(
    StorageItem.LockedTokenClaimTransaction + transactionId,
    JSON.stringify(value),
  );
};

export const removeLockedTokenClaimItem = (transactionId: string): void => {
  localStorage.removeItem(StorageItem.LockedTokenClaimTransaction + transactionId);
};

export const getNotificationItem = (memberId: string): unknown | null => {
  const item = localStorage.getItem(StorageItem.Notification + memberId);
  try {
    return item ? JSON.parse(item) : null;
  } catch (err) {
    console.error('Error while parsing local storage notification item', err);
    return null;
  }
};

export const setNotificationItem = (memberId: string, value: unknown): void => {
  localStorage.setItem(StorageItem.Notification + memberId, JSON.stringify(value));
};

export const getItem = (itemName: StorageItem): unknown | null => {
  const item = localStorage.getItem(itemName);
  return item ? JSON.parse(item) : null;
};

export const setItem = (itemName: StorageItem, value: unknown): void => {
  localStorage.setItem(itemName, JSON.stringify(value));
};

export const removeItem = (itemName: StorageItem): void => {
  localStorage.removeItem(itemName);
};
