import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';

export const isProdEnv = () => functions.config()?.environment?.type === 'prod'

export const isEmulatorEnv = functions.config()?.environment?.type === 'emulator'

export const getRoyaltyPercentage = () => Number(functions.config()?.tokensale?.percentage)

export const getSpaceOneRoyaltyPercentage = () => Number(functions.config()?.tokensale?.spaceonepercentage)

export const getRoyaltySpaces = (): string[] => [functions.config()?.tokensale?.spaceone, functions.config()?.tokensale?.spacetwo].filter(space => !isEmpty(space))
