import { Observable } from 'rxjs';
import { WebSocket } from 'ws';

export const sendLiveUpdates = <T>(socket: WebSocket, observable: Observable<T>) => {
  let isAlive = true;
  const pingInterval = setInterval(() => {
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
    subscription.unsubscribe();
    socket.close(closeCode);
    clearInterval(pingInterval);
  };
};
