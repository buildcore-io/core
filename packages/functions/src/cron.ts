import {
  STAKE_REWARD_CRON_INTERVAL_CONFIG,
  STAKE_REWARD_TEST_CRON_INTERVAL_CONFIG,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import { markAwardsAsCompleteCron } from './cron/award.cron';
import { getLatestBitfinexPricesCron } from './cron/bitfinex.cron';
import { updateFloorPriceOnCollections } from './cron/collection.floor.price.cron';
import { uploadMediaToWeb3 } from './cron/media.cron';
import { finalizeAllNftAuctions, hidePlaceholderAfterSoldOutCron } from './cron/nft.cron';
import { processExpiredNftStakes } from './cron/nftStake.cron';
import { voidExpiredOrdersCron } from './cron/orders.cron';
import { removeExpiredStakesFromSpace } from './cron/stake.cron';
import { stakeRewardCronTask } from './cron/stakeReward.cron';
import { cancelExpiredSale, tokenCoolDownOver } from './cron/token.cron';
import { retryWallet } from './cron/wallet.cron';
import { isEmulatorEnv, isProdEnv } from './utils/config.utils';

const markAwardsAsComplete = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(markAwardsAsCompleteCron);

const getLatestBitfinexPrices = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(getLatestBitfinexPricesCron);

const retryWalletCron = functions.pubsub.schedule('every 2 minutes').onRun(retryWallet);

const voidExpiredOrders = functions.pubsub.schedule('every 1 minutes').onRun(voidExpiredOrdersCron);

const finalizeAuctionNft = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(finalizeAllNftAuctions);

const hidePlaceholderAfterSoldOut = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(hidePlaceholderAfterSoldOutCron);

const tokenCoolDownOverCron = functions.pubsub.schedule('every 1 minutes').onRun(tokenCoolDownOver);

const cancelExpiredSaleCron = functions.pubsub.schedule('every 1 minutes').onRun(cancelExpiredSale);

const stakeRewardCron = functions.pubsub
  .schedule(
    isProdEnv() ? STAKE_REWARD_CRON_INTERVAL_CONFIG : STAKE_REWARD_TEST_CRON_INTERVAL_CONFIG,
  )
  .onRun(stakeRewardCronTask);

const removeExpiredStakesFromSpaceCron = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(removeExpiredStakesFromSpace);

const mediaUploadCron = functions
  .runWith({
    memory: '4GB',
  })
  .pubsub.schedule('every 1 minutes')
  .onRun(uploadMediaToWeb3);

const removeExpiredNftStakes = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(processExpiredNftStakes);

const updateFloorPriceOnCollectionsCron = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(updateFloorPriceOnCollections);

export const cron = isEmulatorEnv()
  ? {}
  : {
      retryWalletCron,
      markAwardsAsComplete,
      voidExpiredOrders,
      finalizeAuctionNft,
      hidePlaceholderAfterSoldOut,
      tokenCoolDownOverCron,
      cancelExpiredSaleCron,
      removeExpiredStakesFromSpaceCron,
      getLatestBitfinexPrices,
      stakeRewardCron,
      mediaUploadCron,
      removeExpiredNftStakes,
      updateFloorPriceOnCollectionsCron,
    };
