import {
  STAKE_REWARD_CRON_INTERVAL_CONFIG,
  STAKE_REWARD_TEST_CRON_INTERVAL_CONFIG,
} from '@build-5/interfaces';
import * as functions from 'firebase-functions/v2';
import { processExpiredAwards } from './cron/award.cron';
import { getLatestBitfinexPricesCron } from './cron/bitfinex.cron';
import { updateFloorPriceOnCollections } from './cron/collection.floor.price.cron';
import { uploadMediaToWeb3 } from './cron/media.cron';
import { finalizeAllNftAuctions, hidePlaceholderAfterSoldOutCron } from './cron/nft.cron';
import { processExpiredNftStakes } from './cron/nftStake.cron';
import { voidExpiredOrdersCron } from './cron/orders.cron';
import { markExpiredProposalCompleted } from './cron/proposal.cron';
import { sessionCleanup } from './cron/session.cron';
import { removeExpiredStakesFromSpace } from './cron/stake.cron';
import { stakeRewardCronTask } from './cron/stakeReward.cron';
import { cancelExpiredSale, tokenCoolDownOver } from './cron/token.cron';
import { removePurchasesFromVolumeStats } from './cron/token.purchase.cron';
import { retryWallet } from './cron/wallet.cron';
import { isProdEnv, isProdOrTestEnv } from './utils/config.utils';

const processExpiredAwardsCron = functions.scheduler.onSchedule(
  'every 1 minutes',
  processExpiredAwards,
);

const getLatestBitfinexPrices = functions.scheduler.onSchedule(
  'every 5 minutes',
  getLatestBitfinexPricesCron,
);

const retryWalletCron = functions.scheduler.onSchedule('every 2 minutes', async () => {
  await retryWallet();
});

const voidExpiredOrders = functions.scheduler.onSchedule('every 1 minutes', async () => {
  await voidExpiredOrdersCron();
});

const finalizeAuctionNft = functions.scheduler.onSchedule(
  'every 1 minutes',
  finalizeAllNftAuctions,
);

const hidePlaceholderAfterSoldOut = functions.scheduler.onSchedule('every 5 minutes', async () => {
  await hidePlaceholderAfterSoldOutCron();
});

const tokenCoolDownOverCron = functions.scheduler.onSchedule('every 1 minutes', async () => {
  await tokenCoolDownOver();
});

const cancelExpiredSaleCron = functions.scheduler.onSchedule('every 1 minutes', cancelExpiredSale);

const stakeRewardCron = functions.scheduler.onSchedule(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
    schedule: isProdEnv()
      ? STAKE_REWARD_CRON_INTERVAL_CONFIG
      : STAKE_REWARD_TEST_CRON_INTERVAL_CONFIG,
  },
  stakeRewardCronTask,
);

const removeExpiredStakesFromSpaceCron = functions.scheduler.onSchedule(
  'every 1 minutes',
  removeExpiredStakesFromSpace,
);

const mediaUploadCron = functions.scheduler.onSchedule(
  { memory: '4GiB', schedule: 'every 1 minutes' },
  async () => {
    await uploadMediaToWeb3();
  },
);

const removeExpiredNftStakes = functions.scheduler.onSchedule(
  'every 1 minutes',
  processExpiredNftStakes,
);

const updateFloorPriceOnCollectionsCron = functions.scheduler.onSchedule(
  {
    timeoutSeconds: 1800,
    schedule: 'every 5 minutes',
  },
  updateFloorPriceOnCollections,
);

const markExpiredProposalCompletedCron = functions.scheduler.onSchedule(
  'every 5 minutes',
  markExpiredProposalCompleted,
);

const removePurchasesFromVolumeStatsCron = functions.scheduler.onSchedule(
  'every 1 minutes',
  removePurchasesFromVolumeStats,
);

const removedExpiresSessions = functions.scheduler.onSchedule(
  { timeoutSeconds: 540, schedule: 'every 24 hour' },
  sessionCleanup,
);

export const cron = isProdOrTestEnv()
  ? {
      retrywalletcron: retryWalletCron,
      processexpiredawardscron: processExpiredAwardsCron,
      voidexpiredorders: voidExpiredOrders,
      finalizeauctionnft: finalizeAuctionNft,
      hideplaceholderaftersoldout: hidePlaceholderAfterSoldOut,
      tokencooldownovercron: tokenCoolDownOverCron,
      cancelexpiredsalecron: cancelExpiredSaleCron,
      removeexpiredstakesfromspacecron: removeExpiredStakesFromSpaceCron,
      getlatestbitfinexprices: getLatestBitfinexPrices,
      stakerewardcron: stakeRewardCron,
      mediauploadcron: mediaUploadCron,
      removeexpirednftstakes: removeExpiredNftStakes,
      updatefloorpriceoncollectionscron: updateFloorPriceOnCollectionsCron,
      markexpiredproposalcompletedcron: markExpiredProposalCompletedCron,
      removepurchasesfromvolumestatscron: removePurchasesFromVolumeStatsCron,
      removedexpiressessions: removedExpiresSessions,
    }
  : {};
