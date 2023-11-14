import { WEN_FUNC } from '@build-5/interfaces';
import { https } from '../../..';

export const auctionCreate = https[WEN_FUNC.createauction];

export const bidAuction = https[WEN_FUNC.bidAuction];
