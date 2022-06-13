import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';
import { TOKEN_SALE } from '../../interfaces/config';

export const isProdEnv = () => functions.config()?.environment?.type === 'prod'

export const isEmulatorEnv = functions.config()?.environment?.type === 'emulator'

export const getRoyaltyPercentage = () => Number(TOKEN_SALE?.percentage)

export const getSpaceOneRoyaltyPercentage = () => Number(TOKEN_SALE?.spaceonepercentage)

export const getRoyaltySpaces = (): string[] => [TOKEN_SALE?.spaceone, TOKEN_SALE?.spacetwo].filter(space => !isEmpty(space))
