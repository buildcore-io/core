import { ALGOLIA_COLLECTIONS, COL, Network, SUB_COL, getMilestoneCol } from '@buildcore/interfaces';
import { ALGOLIA_TRIGGER_SCALE, TRIGGER_SCALE } from '../../scale.settings';
import { algoliaTrigger } from '../../triggers/algolia/algolia.trigger';
import { onAwardUpdated } from '../../triggers/award.trigger';
import { onCollectionStatsWrite } from '../../triggers/collection.stats.trigger';
import { onCollectionUpdated } from '../../triggers/collection.trigger';
import { handleMilestoneTransactionWrite } from '../../triggers/milestone-transactions-triggers/milestone-transaction.trigger';
import { onMnemonicUpdated } from '../../triggers/mnemonic.trigger';
import { onNftWrite } from '../../triggers/nft.trigger';
import { onProposalWrite } from '../../triggers/proposal.trigger';
import { onTokenPurchaseCreated } from '../../triggers/token-trading/token-purchase.trigger';
import { onTokenTradeOrderWrite } from '../../triggers/token-trading/token-trade-order.trigger';
import { onTokenStatusUpdated } from '../../triggers/token.trigger';
import { onTransactionWrite } from '../../triggers/transaction-trigger/transaction.trigger';
import { isDevEnv, isProdEnv } from '../../utils/config.utils';
import { WEN_FUNC_TRIGGER } from '../common';
import { onCreate, onUpdate, onWrite } from './trigger';

exports[WEN_FUNC_TRIGGER.onProposalWrite] = onWrite({
  col: COL.PROPOSAL,
  handler: onProposalWrite,
});

exports[WEN_FUNC_TRIGGER.onAwardUpdated] = onUpdate({
  col: COL.AWARD,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onAwardUpdated],
  handler: onAwardUpdated,
});

exports[WEN_FUNC_TRIGGER.onCollectionUpdated] = onUpdate({
  col: COL.COLLECTION,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onCollectionUpdated],
  handler: onCollectionUpdated,
});

exports[WEN_FUNC_TRIGGER.onTokenStatusUpdated] = onUpdate({
  col: COL.TOKEN,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onTokenStatusUpdated],
  handler: onTokenStatusUpdated,
});

exports[WEN_FUNC_TRIGGER.onTokenTradeOrderWrite] = onWrite({
  col: COL.TOKEN_MARKET,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onTokenTradeOrderWrite],
  handler: onTokenTradeOrderWrite,
});

exports[WEN_FUNC_TRIGGER.onTokenPurchaseCreated] = onCreate({
  col: COL.TOKEN_PURCHASE,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onTokenPurchaseCreated],
  handler: onTokenPurchaseCreated,
});

exports[WEN_FUNC_TRIGGER.onNftWrite] = onWrite({
  col: COL.NFT,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onNftWrite],
  handler: onNftWrite,
});

exports[WEN_FUNC_TRIGGER.onTransactionWrite] = onWrite({
  col: COL.TRANSACTION,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onTransactionWrite],
  handler: onTransactionWrite,
});

exports[WEN_FUNC_TRIGGER.onMnemonicUpdated] = onUpdate({
  col: COL.MNEMONIC,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onMnemonicUpdated],
  handler: onMnemonicUpdated,
});

exports[WEN_FUNC_TRIGGER.onCollectionStatsWrite] = onWrite({
  col: COL.COLLECTION,
  subCol: SUB_COL.STATS,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onCollectionStatsWrite],
  handler: onCollectionStatsWrite,
});

export const algolia = (isDevEnv() ? [] : ALGOLIA_COLLECTIONS).reduce(
  (acc, act) => ({
    ...acc,
    [`${WEN_FUNC_TRIGGER.algolia}${act}`]: onWrite({
      col: act,
      options: ALGOLIA_TRIGGER_SCALE[act],
      handler: algoliaTrigger,
    }),
  }),
  {},
);

const getMilestoneTrigger = (networks: Network[]) =>
  networks.reduce(
    (acc, act) => ({
      ...acc,
      [`${WEN_FUNC_TRIGGER.onMilestoneTransactionWrite}${act}`]: onWrite({
        col: getMilestoneCol(act),
        subCol: SUB_COL.TRANSACTIONS,
        options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onMilestoneTransactionWrite],
        handler: handleMilestoneTransactionWrite(act),
      }),
    }),
    {},
  );

const prodMilestoneTriggers = getMilestoneTrigger([Network.IOTA, Network.SMR]);
const testMilestoneTriggers = getMilestoneTrigger([Network.RMS]);

export const milestoneTriggers = isProdEnv()
  ? prodMilestoneTriggers
  : { ...prodMilestoneTriggers, ...testMilestoneTriggers };
