import fetch from 'node-fetch';

export default async () => {
  console.log('Resetting DB...');
  return fetch('http://localhost:8080/emulator/v1/projects/soonaverse/databases/(default)/documents', {
        method: 'DELETE'
  })
};
