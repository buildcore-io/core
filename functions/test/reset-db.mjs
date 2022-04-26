import test from 'firebase-functions-test';

export default async () => {
  console.log('Resetting DB...');
  test({ projectId: 'soonaverse-dev' }).firestore.clearFirestoreData(
    'soonaverse-dev',
  );
};
