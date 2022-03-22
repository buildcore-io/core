export enum StorageItem {
  Auth = 'App/auth',
  AuthAddress = 'App/authAddress',
  Theme = 'App/theme',
  VerificationTransaction = 'App/verificationTransaction',
  CheckoutTransaction = 'App/checkoutTransaction',
  BidTransaction = 'App/bidTransaction-',
}

export const getItem = (itemName: StorageItem): unknown | null => {
  const item = localStorage.getItem(itemName);
  return item ? JSON.parse(item) : null;
};

export const getBitItemItem = (nftId: string): unknown | null => {
  const item = localStorage.getItem(StorageItem.BidTransaction + nftId);
  return item ? JSON.parse(item) : null;
};

export const setItem = (itemName: StorageItem, value: unknown): void => {
  localStorage.setItem(itemName, JSON.stringify(value));
};

export const setBitItemItem = (nftId: string, value: unknown): void => {
  localStorage.setItem(StorageItem.BidTransaction + nftId, JSON.stringify(value));
};

export const removeBitItemItem = (nftId: string): void => {
  localStorage.removeItem(StorageItem.BidTransaction + nftId);
};

export const removeItem = (itemName: StorageItem): void => {
  localStorage.removeItem(itemName);
};
