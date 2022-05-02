import * as functions from 'firebase-functions';

export const isProdEnv = functions.config()?.environment?.type === 'prod'
