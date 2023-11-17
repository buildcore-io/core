import { finalizeAuctions } from '../../cron/auction.cron';
import { processExpiredAwards } from '../../cron/award.cron';
import { getLatestBitfinexPricesCron } from '../../cron/bitfinex.cron';
import { updateFloorPriceOnCollections } from '../../cron/collection.floor.price.cron';
import { uploadMediaToWeb3 } from '../../cron/media.cron';
import { hidePlaceholderAfterSoldOutCron } from '../../cron/nft.cron';
import { voidExpiredOrdersCron } from '../../cron/orders.cron';
import { markExpiredProposalCompleted } from '../../cron/proposal.cron';
import { removeExpiredStakesFromSpace } from '../../cron/stake.cron';
import { onStakeRewardExpired } from '../../cron/stakeReward.cron';
import { cancelExpiredSale, tokenCoolDownOver } from '../../cron/token.cron';
import { removePurchasesFromVolumeStats } from '../../cron/token.purchase.cron';
import { retryWallet } from '../../cron/wallet.cron';
import { CRON_TRIGGER_SCALE } from '../../scale.settings';
import { WEN_SCHEDULED } from '../common';
import { onSchedule } from './scheduled';

exports[WEN_SCHEDULED.retryWallet] = onSchedule({
  schedule: 'every 2 minutes',
  handler: retryWallet,
});

exports[WEN_SCHEDULED.processExpiredAwards] = onSchedule({
  schedule: 'every 1 minutes',
  handler: processExpiredAwards,
});

exports[WEN_SCHEDULED.voidExpiredOrders] = onSchedule({
  schedule: 'every 1 minutes',
  handler: voidExpiredOrdersCron,
});

exports[WEN_SCHEDULED.finalizeAuctions] = onSchedule({
  schedule: 'every 1 minutes',
  handler: finalizeAuctions,
});

exports[WEN_SCHEDULED.hidePlaceholderAfterSoldOut] = onSchedule({
  schedule: 'every 5 minutes',
  handler: hidePlaceholderAfterSoldOutCron,
});

exports[WEN_SCHEDULED.tokenCoolDownOver] = onSchedule({
  schedule: 'every 1 minutes',
  handler: tokenCoolDownOver,
});

exports[WEN_SCHEDULED.cancelExpiredSale] = onSchedule({
  schedule: 'every 1 minutes',
  handler: cancelExpiredSale,
});

exports[WEN_SCHEDULED.removeExpiredStakesFromSpace] = onSchedule({
  schedule: 'every 1 minutes',
  handler: removeExpiredStakesFromSpace,
});

exports[WEN_SCHEDULED.getLatestBitfinexPrices] = onSchedule({
  schedule: 'every 5 minutes',
  handler: getLatestBitfinexPricesCron,
});

exports[WEN_SCHEDULED.onStakeRewardExpired] = onSchedule({
  runtimeOptions: CRON_TRIGGER_SCALE[WEN_SCHEDULED.onStakeRewardExpired],
  schedule: 'every 1 hours',
  handler: onStakeRewardExpired,
});

exports[WEN_SCHEDULED.mediaUpload] = onSchedule({
  runtimeOptions: CRON_TRIGGER_SCALE[WEN_SCHEDULED.mediaUpload],
  schedule: 'every 1 minutes',
  handler: uploadMediaToWeb3,
});

exports[WEN_SCHEDULED.removeExpiredNftStakes] = onSchedule({
  schedule: 'every 1 minutes',
  handler: removeExpiredStakesFromSpace,
});

exports[WEN_SCHEDULED.updateFloorPriceOnCollections] = onSchedule({
  runtimeOptions: CRON_TRIGGER_SCALE[WEN_SCHEDULED.updateFloorPriceOnCollections],
  schedule: 'every 1 hours',
  handler: updateFloorPriceOnCollections,
});

exports[WEN_SCHEDULED.markExpiredProposalCompleted] = onSchedule({
  schedule: 'every 5 minutes',
  handler: markExpiredProposalCompleted,
});

exports[WEN_SCHEDULED.removePurchasesFromVolumeStats] = onSchedule({
  schedule: 'every 1 minutes',
  handler: removePurchasesFromVolumeStats,
});
