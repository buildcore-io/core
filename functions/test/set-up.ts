import * as admin from 'firebase-admin';
import test from "firebase-functions-test";
import { AppCheck } from './../interfaces/config';

AppCheck.enabled = false;
process.env.GCLOUD_PROJECT = 'soonaverse';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
export const testEnv = test({ projectId: process.env.GCLOUD_PROJECT});

