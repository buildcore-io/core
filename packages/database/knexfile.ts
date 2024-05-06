require('dotenv').config();
export default {
  client: 'pg',
  connection: {
    user: 'postgres',
    password: 'postgres',
    database: 'buildcore',
    host: 'localhost',
    port: 2345,
  },
  migrations: {
    directory: './migrations',
    extension: 'ts',
  },
};
