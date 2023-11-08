require('dotenv').config({ path: __dirname + '/.env' });
import { ApiRoutes } from '@build-5/interfaces';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { get } from 'lodash';
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
import { getNftIds } from './metadataNft/getNftIds';
import { getNftMutableMetadata } from './metadataNft/getNftMutableMetadata';
import { getNftMutableMetadataHistory } from './metadataNft/getNftMutableMetadataHistory';
import { sendLiveUpdates } from './sendLiveUpdates';

const port = 8080;
const app = express();

app.use(cors());

app.get('/*', async (req, res) => {
  const jwtToken = req.headers.authorization?.split(' ')[1];
  const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
  url.searchParams.append('token', jwtToken || '');
  await onConnection(url, res);
});

const wsServer = new ws.Server({ noServer: true });

wsServer.on('connection', async (socket, req) => {
  onConnection(new URL(`ws://${req.headers.host}${req.url}`), socket);
});

const server = app.listen(port);

server.setTimeout(0);

server.on('upgrade', (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (socket) => {
    wsServer.emit('connection', socket, request);
  });
});

const onConnection = async (url: URL, res: express.Response | ws.WebSocket) => {
  try {
    const project = getProjectId(url);
    url.searchParams.delete('token');

    const observable = await getObservable(project, url);
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

const getObservable = (project: string, url: URL): Promise<Observable<unknown>> => {
  const endpoint = url.pathname.replace('/api', '');
  switch (endpoint) {
    case ApiRoutes.GET_BY_ID:
      return getById(url.href);
    case ApiRoutes.GET_MANY_BY_ID:
      return getManyById(url.href);
    case ApiRoutes.GET_MANY:
      return getMany(project, url.href);
    case ApiRoutes.GET_MANY_ADVANCED:
      return getManyAdvanced(project, url.href);
    case ApiRoutes.GET_UPDATED_AFTER:
      return getUpdatedAfter(project, url.href);
    case ApiRoutes.GET_TOKEN_PRICE:
      return getTokenPrice(url.href);
    case ApiRoutes.GET_AVG_PRICE:
      return getAvgPrice(url.href);
    case ApiRoutes.GET_PRICE_CHANGE:
      return getPriceChange(url.href);
    case ApiRoutes.GET_ADDRESSES:
      return getAddresses(url.href);
    case ApiRoutes.GET_TOP_MILESTONES:
      return getTopMilestones(url.href);
    case ApiRoutes.GET_NFT_MUTABLE_METADATA:
      return getNftMutableMetadata(url.href);
    case ApiRoutes.GET_NFT_IDS:
      return getNftIds(url.href);
    case ApiRoutes.GET_NFT_MUTABLE_METADATA_HISTORY:
      return getNftMutableMetadataHistory(url.href);
    default:
      throw { code: 400, message: 'Invalid route' };
  }
};

const getProjectId = (url: URL) => {
  try {
    const jwtToken = url.searchParams.get('token');
    const payload = jwt.verify(jwtToken || '', process.env.JWT_SECRET!);
    const project = get(payload, 'project', '');
    if (!project) {
      throw { code: 401, message: 'Unauthorized' };
    }
    return project;
  } catch {
    throw { code: 401, message: 'Unauthorized' };
  }
};
