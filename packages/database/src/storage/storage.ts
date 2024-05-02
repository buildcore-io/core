import { FirebaseStorage } from './impl';
import { IStorage } from './interfaces';

export const storage = (): IStorage => new FirebaseStorage();
