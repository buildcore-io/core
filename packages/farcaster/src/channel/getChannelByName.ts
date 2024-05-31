import { ChannelListResponse } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import axios from 'axios';

export const getChannelByName = async (name: string) => {
  const options = {
    url: 'https://api.neynar.com/v2/farcaster/channel/search',
    method: 'GET',
    headers: { accept: 'application/json', api_key: process.env.NEYNAR_API_KEY },
    params: { q: name },
  };
  const response = (await axios(options)).data as ChannelListResponse;
  if (!response.channels[0]) {
    throw new Error(`Channel ${name} not found`);
  }
  return response.channels[0];
};
