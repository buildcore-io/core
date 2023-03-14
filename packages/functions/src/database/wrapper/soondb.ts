import { Firestore } from './firestore';
import { IDatabase } from './interfaces';

const firestore = new Firestore();

export const soonDb = (): IDatabase => firestore;
