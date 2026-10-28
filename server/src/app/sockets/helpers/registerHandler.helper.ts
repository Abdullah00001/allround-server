import { AuthenticatedSocket } from '@/app/sockets/types/chat.types';
import { globalSocketErrorMiddleware } from '@/app/middlewares/socket.middlewares';
import { TRegisterHandler } from '@/app/sockets/types/helper.types';

const registerHandler = ({ events, socket }: TRegisterHandler): void => {
  events.forEach(({ eventName, handler }) => {
    socket.on(eventName, async (data) => {
      try {
        await handler(socket, data);
      } catch (error) {
        globalSocketErrorMiddleware(
          error as Error,
          socket as AuthenticatedSocket
        );
      }
    });
  });
};

export default registerHandler;
