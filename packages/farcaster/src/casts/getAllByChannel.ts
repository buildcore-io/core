import { CastWithInteractions, FeedResponse } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import axios from 'axios';

export const getAllCastsByChannelId = async (channel_id: string) => {
  const casts: CastWithInteractions[] = [];
  let cursor: string | undefined = undefined;
  do {
    const options = {
      url: 'https://api.neynar.com/v2/farcaster/feed/channels',
      method: 'GET',
      headers: { accept: 'application/json', api_key: process.env.NEYNAR_API_KEY },
      params: {
        channel_ids: channel_id,
        with_recasts: false,
        with_replies: false,
        limit: 100,
        cursor,
      },
    };
    const feed = (await axios(options)).data as FeedResponse;
    casts.push(...feed.casts);
    cursor = feed.next.cursor || undefined;
  } while (cursor);

  return casts;
};
