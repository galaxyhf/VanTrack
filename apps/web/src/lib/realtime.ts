import { io } from 'socket.io-client';
import { API, post } from './api';
export function connectRealtime() {
  const socket = io(API, { withCredentials: true, transports: ['websocket'] });
  let closed = false;
  const close = socket.disconnect.bind(socket);
  socket.disconnect = () => {
    closed = true;
    return close();
  };
  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect' && !closed)
      void post('/auth/refresh')
        .then(() => {
          if (!closed) socket.connect();
        })
        .catch(() => undefined);
  });
  return socket;
}
