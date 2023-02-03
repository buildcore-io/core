import { Bucket } from '@soonaverse/interfaces';
const useEmulator = false;
export const environment = {
  production: false,
  useEmulators: useEmulator,
  captcha: '6LfYqHQdAAAAAI91N8xl6pc0LIUj4s9ksqj02CWm',
  fbConfig: {
    apiKey: 'AIzaSyDZhaoZ2Kr4GW-f1vKIlm3cwp77Q3YyzNM',
    authDomain: 'soonaverse-test.firebaseapp.com',
    projectId: useEmulator ? 'soonaverse' : 'soonaverse-test',
    storageBucket: Bucket.TEST,
    messagingSenderId: '206252445538',
    appId: '1:206252445538:web:3cfb62b01468748631663b',
  },
  algolia: {
    appId: '6MPUETJRDB',
    key: '5c053a0370395f0fe8cf7ce9e5a21a72',
  },
  soonaversePlaceholder: 'https://soonaverse.com/favicon.ico',
};
