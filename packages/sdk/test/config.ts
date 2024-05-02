import { Buildcore } from '../src/https';

export interface AddressDetails {
  bech32: string;
  hex: string;
  mnemonic: string;
}

export const address: AddressDetails = {
  mnemonic:
    'laundry bar blind toy tag mask taxi senior twist life pair result endless sauce dizzy electric butter ice dentist check number spike orbit paper',
  hex: '0x04c0dbd2d99a7efbbc622ae00a9d40c6cc12ad1b31868e339657bb69b3638d6c',
  bech32: 'rms1qqzvpk7jmxd8a7auvg4wqz5agrrvcy4drvccdr3njetmk6dnvwxkc25x9uj',
};

export const address_secondary: AddressDetails = {
  mnemonic:
    'want toe guide chaos galaxy relax grass cloth bunker frown street any fox today can element wife tenant deer bulk inmate host april have',
  hex: '0xbee278544f998b80d96fb07dbbd82a0fd978ef99a9d9fef581acdef2343e1265',
  bech32: 'rms1qzlwy7z5f7vchqxed7c8mw7c9g8aj780nx5anlh4sxkdau358cfx2tt0zw2',
};

export const BuildcoreLocal = 'http://127.0.0.1:5001/soonaverse-dev/us-central1' as Buildcore;
export const BuildcoreLocalApi = 'http://localhost:8080' as Buildcore;
export const BuildcoreLocalKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNjk5MjgyMTQxfQ.Bd0IZNdtc3ne--CC1Bk5qDgWl4NojAsX64K1rCj-5Co';
export const BuildcoreLocalApiKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIweDU1MWZkMmM3YzdiZjM1NmJhYzE5NDU4N2RhYjJmY2Q0NjQyMDA1NGIiLCJwcm9qZWN0IjoiMHg0NjIyM2VkZDQxNTc2MzVkZmM2Mzk5MTU1NjA5ZjMwMWRlY2JmZDg4IiwiaWF0IjoxNjk1ODUyNTk2fQ.WT9L4H9eDdFfJZMrfxTKhEq4PojNWSGNv_CbmlG9sJg';
