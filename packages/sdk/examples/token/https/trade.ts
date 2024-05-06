import {
  Dataset,
  Network,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@buildcore/interfaces';
import { Buildcore, SoonaverseApiKey, https } from '@buildcore/sdk';
import { address } from '../../utils/secret';
import { walletSign } from '../../utils/utils';

async function main() {
  const origin = Buildcore.TEST;

  const member = await https(origin).createMember({
    address: address.bech32,
    signature: '',
    body: {
      address: address.bech32,
    },
  });

  try {
    const signature = await walletSign(member.uid, address);
    const response = await https(origin)
      .project(SoonaverseApiKey[origin])
      .dataset(Dataset.TOKEN_MARKET)
      .tradeToken({
        address: address.bech32,
        signature: signature.signature,
        publicKey: {
          hex: signature.publicKey,
          network: Network.RMS,
        },
        body: {
          count: 10,
          symbol: 'IOTA',
          price: 0.002,
          type: 'buy',
        },
      });

    console.log(response);
  } catch (e) {
    console.log(e);
    return;
  }
}

main().then(() => process.exit());
mainRead().then(() => process.exit());

// Other examples
async function mainRead() {
  // Get all active BUYs through live stream. Use getMemberBidsLive to get member's one.
  const tokenId = 'tokenId';
  await https(origin)
    .project(SoonaverseApiKey[origin])
    .dataset(Dataset.TOKEN_MARKET)
    .getBidsLive(tokenId, TokenTradeOrderType.BUY, TokenTradeOrderStatus.ACTIVE)
    .subscribe((bids) => {
      console.log(bids);
    });

  // Get all active SELLs through live stream. Use getMemberBidsLive to get member's one.
  await https(origin)
    .project(SoonaverseApiKey[origin])
    .dataset(Dataset.TOKEN_MARKET)
    .getBidsLive(tokenId, TokenTradeOrderType.SELL, TokenTradeOrderStatus.ACTIVE)
    .subscribe((bids) => {
      console.log(bids);
    });

  // Get live stream of token purchases
  await https(origin)
    .project(SoonaverseApiKey[origin])
    .dataset(Dataset.TOKEN_PURCHASE)
    .getPuchasesLive(tokenId)
    .subscribe((bids) => {
      console.log(bids);
    });
}
