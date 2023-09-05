import { ApiRoutes } from '@build-5/interfaces';
import express from 'express';
import { Observable, first } from 'rxjs';
import ws from 'ws';
import { getAddresses } from './getAddresses';
import { getAvgPrice } from './getAvgPrice';
import { getById } from './getById';
import { getMany } from './getMany';
import { getManyAdvanced } from './getManyAdvanced';
import { getManyById } from './getManyById';
import { getPriceChange } from './getPriceChange';
import { getTokenPrice } from './getTokenPrice';
import { getTopMilestones } from './getTopMilestones';
import { getUpdatedAfter } from './getUpdatedAfter';
import { sendLiveUpdates } from './sendLiveUpdates';
import cors from 'cors';

const port = process.env.PORT || 3000;
const app = express();

app.use(cors());

Object.values(ApiRoutes).forEach((route) => {
  app.get(route, (req, res) => onConnection(req.url, res));
});

const wsServer = new ws.Server({ noServer: true });

wsServer.on('connection', async (socket, request) => {
  onConnection(request.url || '', socket);
});

const server = app.listen(port);

server.setTimeout(0);

server.on('upgrade', (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (socket) => {
    wsServer.emit('connection', socket, request);
  });
});

const onConnection = async (url: string, res: express.Response | ws.WebSocket) => {
  try {
    const observable = await getObservable(url);
    if (res instanceof ws.WebSocket) {
      sendLiveUpdates(res, observable);
      return;
    }
    observable.pipe(first()).subscribe((r) => {
      res.send(r);
    });
  } catch (error: any) {
    if (res instanceof ws.WebSocket) {
      res.close(1003, error.message || 'Unknown');
      return;
    }
    res.status(error.code || 500);
    res.send(error.message || 'Unknown');
  }
};

const getObservable = (url: string): Promise<Observable<unknown>> => {
  const route = url.replace('/api', '').split('?')[0];
  switch (route) {
    case ApiRoutes.GET_BY_ID:
      return getById(url);
    case ApiRoutes.GET_MANY_BY_ID:
      return getManyById(url);
    case ApiRoutes.GET_MANY:
      return getMany(url);
    case ApiRoutes.GET_MANY_ADVANCED:
      return getManyAdvanced(url);
    case ApiRoutes.GET_UPDATED_AFTER:
      return getUpdatedAfter(url);
    case ApiRoutes.GET_TOKEN_PRICE:
      return getTokenPrice(url);
    case ApiRoutes.GET_AVG_PRICE:
      return getAvgPrice(url);
    case ApiRoutes.GET_PRICE_CHANGE:
      return getPriceChange(url);
    case ApiRoutes.GET_ADDRESSES:
      return getAddresses(url);
    case ApiRoutes.GET_TOP_MILESTONES:
      return getTopMilestones(url);
    default:
      throw { code: 400, message: 'Invalid route' };
  }
};
