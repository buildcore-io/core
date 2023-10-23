import { firestore } from 'firebase-admin';

export const docToAlgoliaData = (data: Record<string, unknown>) => processObject(data);

const processObject = (data: Record<string, unknown>) =>
  Object.entries(data).reduce((acc, [key, val]) => {
    const value = processValue(val);
    return isValid(value) ? { ...acc, [key]: value } : acc;
  }, {} as Record<string, unknown>);

const processValue = (value: unknown): unknown => {
  if (value instanceof firestore.Timestamp) {
    return value.toDate().getTime();
  }
  if (value instanceof Array) {
    return value.map(processValue);
  }
  if (value instanceof Object) {
    return processObject({ ...value });
  }
  return value;
};

const isValid = (value: unknown) => typeof value !== undefined && value !== null;
