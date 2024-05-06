import { IDatabase } from '../interfaces/database';
import { PgDatabase } from './postgres';

export const database = (): IDatabase => new PgDatabase();
