import * as admin from 'firebase-admin';
import test from 'firebase-functions-test';
import { AppCheck } from './../interfaces/config';

AppCheck.enabled = false;
const projectId = 'soonaverse-dev'
process.env.GCLOUD_PROJECT = projectId;
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({ projectId });
export const testEnv = test({ projectId });
