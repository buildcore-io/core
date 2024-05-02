import { IStorage } from './interfaces';
import { FirebaseStorage } from './storage';

export const build5Storage = (): IStorage => new FirebaseStorage();
