import * as functions from 'firebase-functions';
import { isEmpty } from 'lodash';

export const isProdEnv = functions.config()?.environment?.type === 'prod'

export const getRoyaltyPercentage = () => Number(functions.config()?.tokenSale?.percentage)

export const getSpaceOneRoyaltyPercentage = () => Number(functions.config()?.tokenSale?.spaceOnePercentage)

export const getRoyaltySpaces = (): string[] => [functions.config()?.tokenSale?.spaceOne, functions.config()?.tokenSale?.spaceTwo].filter(space => !isEmpty(space))
