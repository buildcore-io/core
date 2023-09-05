import admin from 'firebase-admin';
import { FirebaseApp } from './app';

admin.initializeApp();

export const build5App = () => new FirebaseApp(admin.app());
