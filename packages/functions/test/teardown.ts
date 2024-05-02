import { build5Db } from '@build-5/database';
import axios from 'axios';
import { tangleClients } from '../src/services/wallet/wallet.service';
import { wallets } from './set-up';

afterAll(async () => {
  await build5Db().destroy();
  for (const client of Object.values(wallets)) {
    await client.client.destroy();
  }
  for (const client of Object.values(tangleClients)) {
    await client.destroy();
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));
  const response = await axios.head('http://localhost:8080/');
  if (response.status !== 200) {
    throw new Error('Server is not running');
  }
});
