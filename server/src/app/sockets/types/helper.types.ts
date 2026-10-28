import { AuthenticatedSocket } from '@/app/sockets/types/chat.types';

export type TEventHandler<T = unknown> = (
  socket: AuthenticatedSocket,
  data: T
) => Promise<unknown> | unknown;

export interface IEventRegistration {
  eventName: string;
  handler: TEventHandler;
}

export type TRegisterHandler = {
  socket: AuthenticatedSocket;
  events: IEventRegistration[];
};
