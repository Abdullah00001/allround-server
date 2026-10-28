import { IEventRegistration } from '@/app/sockets/types/helper.types';
import { SOCKET_EVENTS } from '@/const';
import {
  handleNotificationCount,
  handleNotificationMarkRead,
  handleNotificationMarkAllRead,
} from '@/app/sockets/handlers/notification/notification.handlers';

export const notificationEventRegistry: IEventRegistration[] = [
  {
    eventName: SOCKET_EVENTS.NOTIFICATION_COUNT,
    handler: handleNotificationCount,
  },
  {
    eventName: SOCKET_EVENTS.NOTIFICATION_MARK_READ,
    handler: handleNotificationMarkRead,
  },
  {
    eventName: SOCKET_EVENTS.NOTIFICATION_MARK_ALL_READ,
    handler: handleNotificationMarkAllRead,
  },
];
