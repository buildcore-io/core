import admin from 'firebase-admin';
import { FirebaseApp } from './app';

admin.initializeApp();

export default admin;

export const build5App = () => new FirebaseApp(admin.app());
