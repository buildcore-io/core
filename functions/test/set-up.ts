import test from 'firebase-functions-test';
import { AppCheck } from './../interfaces/config';

AppCheck.enabled = false;
const projectId = 'soonaverse-dev'
process.env.GCLOUD_PROJECT = projectId;

const getConfig = () => {
  if (process.env.LOCAL_TEST) {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    return { projectId }
  }
  return {
    databaseURL: `https://${projectId}.firebaseio.com`,
    projectId,
    storageBucket: `${projectId}.appspot.com`
  }
}

export const testEnv = process.env.LOCAL_TEST ? test(getConfig()) : test(getConfig(), './test-service-account-key.json')

beforeEach(async () => {
  if (process.env.LOCAL_TEST) {
    await testEnv.firestore.clearFirestoreData({ projectId: 'soonaverse-dev' })
  }
});
