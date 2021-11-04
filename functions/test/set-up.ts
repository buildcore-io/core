import * as admin from 'firebase-admin';
import test from "firebase-functions-test";

// firebase automatically picks up on these environment variables:
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({
    projectId: 'project-id',
    credential: admin.credential.applicationDefault()
});

export const testEnv = test();
