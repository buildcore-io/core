import * as admin from 'firebase-admin';
import { FirebaseApp } from './app';

admin.initializeApp();

export const soonApp = () => new FirebaseApp(admin.app());
