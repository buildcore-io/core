import { IDatabase } from '../interfaces/database';
import { PgDatabase } from './postgres';

export const build5Db = (): IDatabase => new PgDatabase();
