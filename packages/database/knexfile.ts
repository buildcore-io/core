require('dotenv').config();
export default {
  client: 'pg',
  connection: {
    user: process.env.DB_USER,
    password: process.env.DB_USER_PWD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
  },
  migrations: {
    directory: './migrations',
    extension: 'ts',
  },
};
