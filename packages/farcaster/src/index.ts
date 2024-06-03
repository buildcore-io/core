import cors from 'cors';
import dayjs from 'dayjs';
import express from 'express';
import { getAllCastsByChannelId } from './casts/getAllByChannel';
import { getChannelByName } from './channel/getChannelByName';
import { calPointsForCast, isLikedByHosts } from './leaderboard';
import { dateBetween } from './utils';

const port = 8080;
const app = express();

app.use(cors());

app.get('/*', async (req, res) => {
  const channelName = 'justbuild';
  const channel = await getChannelByName(channelName);
  const hosts = channel.hosts?.map((h) => h.fid) || [];
  const casts = await getAllCastsByChannelId(channelName);

  const castedAfter = dayjs.unix(Number(req.query.castedAfter));
  const castedBefore = dayjs.unix(Number(req.query.castedBefore));

  const points = casts
    .filter(
      (c) =>
        dateBetween(dayjs(c.timestamp), castedAfter, castedBefore) &&
        !hosts.includes(c.author.fid) &&
        isLikedByHosts(c, hosts),
    )
    .reduce(
      (acc, cast) => {
        const author = cast.author.fid;
        const points = calPointsForCast(cast);
        const name = cast.author.display_name;
        return { ...acc, [author]: { name, points: (acc[author]?.points || 0) + points } };
      },
      {} as { [key: string]: { fid: string; name: string; points: number } },
    );

  const result = Object.entries(points)
    .sort((a, b) => b[1].points - a[1].points)
    .map(([author, { name, points }]) => ({ author, name, points }));
  res.send(result).end();
});

const server = app.listen(port);

server.setTimeout(0);
