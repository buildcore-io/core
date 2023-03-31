import admin from 'firebase-admin';
import { FirebaseApp } from './app';

admin.initializeApp();

export default admin;

export const soonApp = () => new FirebaseApp(admin.app());
