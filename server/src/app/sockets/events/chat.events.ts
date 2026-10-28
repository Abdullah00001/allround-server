import { IEventRegistration } from '@/app/sockets/types/helper.types';
import { SOCKET_EVENTS } from '@/const';
import {
  handleConversationJoin,
  handleConversationLeave,
} from '@/app/sockets/handlers/chat/conversation.handler';
import {
  handleMessageRead,
  handleTypingStart,
  handleTypingStop,
} from '@/app/sockets/handlers/chat/privateChat.handlers';

export const chatEventRegistry: IEventRegistration[] = [
  {
    eventName: SOCKET_EVENTS.CONVERSATION_JOIN,
    handler: handleConversationJoin,
  },
  {
    eventName: SOCKET_EVENTS.CONVERSATION_LEAVE,
    handler: handleConversationLeave,
  },
  {
    eventName: SOCKET_EVENTS.MESSAGE_READ,
    handler: handleMessageRead,
  },
  {
    eventName: SOCKET_EVENTS.TYPING_START,
    handler: handleTypingStart,
  },
  {
    eventName: SOCKET_EVENTS.TYPING_STOP,
    handler: handleTypingStop,
  },
];
