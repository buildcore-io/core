import { WEN_FUNC } from '@build-5/interfaces';
import { https } from '../../../..';

export const createToken = https[WEN_FUNC.createToken];

export const updateToken = https[WEN_FUNC.updateToken];

export const setTokenAvailableForSale = https[WEN_FUNC.setTokenAvailableForSale];

export const cancelPublicSale = https[WEN_FUNC.cancelPublicSale];

export const creditToken = https[WEN_FUNC.creditToken];

export const orderToken = https[WEN_FUNC.orderToken];

export const enableTokenTrading = https[WEN_FUNC.enableTokenTrading];

export const airdropToken = https[WEN_FUNC.airdropToken];

export const claimAirdroppedToken = https[WEN_FUNC.claimAirdroppedToken];
