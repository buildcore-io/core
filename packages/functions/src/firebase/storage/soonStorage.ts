import { soonApp } from '../app/soonApp';
import { IStorage } from './interfaces';
import { FirebaseStorage } from './storage';

export const soonStorage = (): IStorage => new FirebaseStorage(soonApp());
