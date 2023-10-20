import { ALGOLIA_COLLECTIONS, COL, Network, SUB_COL, getMilestoneCol } from '@build-5/interfaces';
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
import { isProdEnv } from '../../utils/config.utils';
import { WEN_FUNC_TRIGGER } from '../common';
import { onCreate, onUpdate, onWrite } from './trigger';

exports[WEN_FUNC_TRIGGER.onProposalWrite] = onWrite({
  document: `${COL.PROPOSAL}/{docId}`,
  handler: onProposalWrite,
});

exports[WEN_FUNC_TRIGGER.onAwardUpdated] = onUpdate({
  document: `${COL.AWARD}/{docId}`,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onAwardUpdated],
  handler: onAwardUpdated,
});

exports[WEN_FUNC_TRIGGER.onCollectionUpdated] = onUpdate({
  document: `${COL.COLLECTION}/{docId}`,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onCollectionUpdated],
  handler: onCollectionUpdated,
});

exports[WEN_FUNC_TRIGGER.onTokenStatusUpdated] = onUpdate({
  document: `${COL.TOKEN}/{docId}`,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onTokenStatusUpdated],
  handler: onTokenStatusUpdated,
});

exports[WEN_FUNC_TRIGGER.onTokenTradeOrderWrite] = onWrite({
  document: `${COL.TOKEN_MARKET}/{docId}`,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onTokenTradeOrderWrite],
  handler: onTokenTradeOrderWrite,
});

exports[WEN_FUNC_TRIGGER.onTokenPurchaseCreated] = onCreate({
  document: `${COL.TOKEN_PURCHASE}/{docId}`,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onTokenPurchaseCreated],
  handler: onTokenPurchaseCreated,
});

exports[WEN_FUNC_TRIGGER.onNftWrite] = onWrite({
  document: `${COL.NFT}/{docId}`,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onNftWrite],
  handler: onNftWrite,
});

exports[WEN_FUNC_TRIGGER.onTransactionWrite] = onWrite({
  document: `${COL.TRANSACTION}/{docId}`,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onTransactionWrite],
  handler: onTransactionWrite,
});

exports[WEN_FUNC_TRIGGER.onMnemonicUpdated] = onUpdate({
  document: `${COL.MNEMONIC}/{docId}`,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onMnemonicUpdated],
  handler: onMnemonicUpdated,
});

exports[WEN_FUNC_TRIGGER.onCollectionStatsWrite] = onWrite({
  document: `${COL.COLLECTION}/{docId}/${SUB_COL.STATS}/{subDocId}`,
  options: TRIGGER_SCALE[WEN_FUNC_TRIGGER.onCollectionStatsWrite],
  handler: onCollectionStatsWrite,
});

export const algolia = ALGOLIA_COLLECTIONS.reduce(
  (acc, act) => ({
    ...acc,
    [`${WEN_FUNC_TRIGGER.algolia}${act}`]: onWrite({
      document: `${act}/{docId}`,
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
        document: `${getMilestoneCol(act)}/{docId}/${SUB_COL.TRANSACTIONS}/{subDocId}`,
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
