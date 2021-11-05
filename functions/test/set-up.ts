import * as admin from 'firebase-admin';
import test from "firebase-functions-test";
import { v4 } from 'uuid';

process.env.GCLOUD_PROJECT = v4();
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
export const testEnv = test({ projectId: process.env.GCLOUD_PROJECT});
