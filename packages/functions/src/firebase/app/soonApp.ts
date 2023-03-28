import admin from '../../admin.config';
import { FirebaseApp } from './app';

export const soonApp = () => new FirebaseApp(admin.app());
