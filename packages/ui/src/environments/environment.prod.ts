import { Bucket } from '@soonaverse/interfaces';
export const environment = {
  production: true,
  useEmulators: false,
  captcha: '6LfYqHQdAAAAAI91N8xl6pc0LIUj4s9ksqj02CWm',
  fbConfig: {
    apiKey: 'AIzaSyB4fcG8rtNWAiAtSmxmK3q3JLfMvtNCGP4',
    authDomain: 'soonaverse.firebaseapp.com',
    projectId: 'soonaverse',
    storageBucket: Bucket.PROD,
    messagingSenderId: '502842886229',
    appId: '1:502842886229:web:fcb7da4040fd19ba742cdc',
  },
  algolia: {
    appId: '2WGM1RPQKZ',
    key: 'ed51a01fc204688339e89ac8e9d53028',
  },
  soonaversePlaceholder: 'https://soonaverse.com/favicon.ico',
};
