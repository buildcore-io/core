import { API_TIMEOUT_SECONDS } from '@build-5/interfaces';
import { Observable } from 'rxjs';
import ws from 'ws';

export const sendLiveUpdates = <T>(socket: ws.WebSocket, observable: Observable<T>) => {
  let isAlive = true;

  const pingPongInterval = setInterval(() => {
    if (!isAlive) {
      closeConnection();
    }
    isAlive = false;
    socket.ping();
  }, 5000);

  socket.on('pong', () => {
    isAlive = true;
  });

  socket.on('close', () => {
    closeConnection();
  });

  socket.on('error', () => {
    closeConnection(1002);
  });

  const timeout = setTimeout(() => {
    closeConnection();
  }, API_TIMEOUT_SECONDS * 1000 * 0.95);

  const subscription = observable.subscribe({
    next: (data) => {
      socket.send(JSON.stringify(data));
    },
    error: (error) => {
      console.error(error);
      closeConnection(1002);
    },
  });

  const closeConnection = (closeCode?: number) => {
    clearInterval(pingPongInterval);
    clearTimeout(timeout);
    subscription.unsubscribe();
    socket.close(closeCode);
  };
};
