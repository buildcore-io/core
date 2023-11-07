import admin from 'firebase-admin';
import { FirebaseApp } from './app';

const defaultApp = admin.initializeApp(undefined, 'defaultApp');

export const build5App = new FirebaseApp(defaultApp);
