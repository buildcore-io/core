require('dotenv').config({ path: __dirname + '/.env' });
import { ApiRoutes, WenError } from '@build-5/interfaces';
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
  const jwtToken = req.headers.authorization?.split(' ')[1] || '';
  const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
  await onConnection(jwtToken, url, res);
});

const wsServer = new ws.Server({ noServer: true });

wsServer.on('connection', async (socket, req) => {
  const timeout = setTimeout(() => {
    socket.close(1002, 'Project api key not provided');
  }, 5000);
  let jwtToken = '';

  socket.on('message', async (message) => {
    clearTimeout(timeout);
    if (!jwtToken) {
      await onConnection(message.toString(), new URL(`ws://${req.headers.host}${req.url}`), socket);
    }
  });
});

const server = app.listen(port);

server.setTimeout(0);

server.on('upgrade', (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (socket) => {
    wsServer.emit('connection', socket, request);
  });
});

const onConnection = async (jwtToken: string, url: URL, res: express.Response | ws.WebSocket) => {
  try {
    const project = getProjectId(jwtToken);

    const isLive = res instanceof ws.WebSocket;
    const observable = await getObservable(project, url, isLive);

    if (isLive) {
      sendLiveUpdates(res, observable);
      return;
    }

    observable.pipe(first()).subscribe({
      next: (r) => {
        res.send(r);
      },
      error: (error) => {
        onError(url, res, error);
      },
    });
  } catch (error: any) {
    onError(url, res, error);
  }
};

const getObservable = (
  project: string,
  url: URL,
  isLive: boolean,
): Promise<Observable<unknown>> => {
  switch (url.pathname) {
    case ApiRoutes.GET_BY_ID:
      return getById(url.href, isLive);
    case ApiRoutes.GET_MANY_BY_ID:
      return getManyById(url.href, isLive);
    case ApiRoutes.GET_MANY:
      return getMany(project, url.href, isLive);
    case ApiRoutes.GET_MANY_ADVANCED:
      return getManyAdvanced(project, url.href, isLive);
    case ApiRoutes.GET_UPDATED_AFTER:
      return getUpdatedAfter(project, url.href, isLive);
    case ApiRoutes.GET_TOKEN_PRICE:
      return getTokenPrice(url.href, isLive);
    case ApiRoutes.GET_AVG_PRICE:
      return getAvgPrice(url.href, isLive);
    case ApiRoutes.GET_PRICE_CHANGE:
      return getPriceChange(url.href, isLive);
    case ApiRoutes.GET_ADDRESSES:
      return getAddresses(url.href, isLive);
    case ApiRoutes.GET_TOP_MILESTONES:
      return getTopMilestones(url.href, isLive);
    case ApiRoutes.GET_NFT_MUTABLE_METADATA:
      return getNftMutableMetadata(url.href);
    case ApiRoutes.GET_NFT_IDS:
      return getNftIds(url.href);
    case ApiRoutes.GET_NFT_MUTABLE_METADATA_HISTORY:
      return getNftMutableMetadataHistory(url.href);
    default:
      throw { code: 400, message: WenError.invalid_route.key };
  }
};

const getProjectId = (jwtToken: string) => {
  try {
    const payload = jwt.verify(jwtToken || '', process.env.JWT_SECRET!);
    const project = get(payload, 'project', '');
    if (!project) {
      throw { code: 401, message: WenError.invalid_project_api_key.key };
    }
    return project;
  } catch {
    throw { code: 401, message: WenError.invalid_project_api_key.key };
  }
};

const onError = (url: URL, res: express.Response | ws.WebSocket, error: any) => {
  console.error(url.href, error);
  if (res instanceof ws.WebSocket) {
    res.close(1003, error.message || 'Unknown');
    return;
  }
  res.status(error.code || 500);
  res.send(getMessage(error));
};

const getMessage = (error: any) => {
  const publicMessages = Object.values(WenError).map((e) => e.key);
  if (error.code === 400 || publicMessages.includes(error.message || '')) {
    return error.message;
  }
  return 'Unknown';
};
