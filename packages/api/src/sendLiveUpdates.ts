import { API_TIMEOUT_SECONDS } from '@build-5/interfaces';
import { Observable } from 'rxjs';
import { Socket } from './index';

export const sendLiveUpdates = <T>(socket: Socket, observable: Observable<T>) => {
  socket.on('pong', () => {
    socket.isAlive = true;
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
    subscription.unsubscribe();
    socket.close(closeCode);
    clearTimeout(timeout);
  };
};
