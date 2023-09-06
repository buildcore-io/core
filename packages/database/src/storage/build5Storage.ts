import { build5App } from '../app/build5App';
import { IStorage } from './interfaces';
import { FirebaseStorage } from './storage';

export const build5Storage = (): IStorage => new FirebaseStorage(build5App());
