import { Notification, NotificationType } from '@prisma/client';

/**
 * Public notification payload for REST and socket clients.
 */
export class NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;

  /**
   * Creates a DTO from explicit field values.
   *
   * @param {NotificationDTO} data - Field bag to assign.
   */
  constructor(data: NotificationDTO) {
    this.id = data.id;
    this.type = data.type;
    this.title = data.title;
    this.message = data.message;
    this.link = data.link;
    this.isRead = data.isRead;
    this.createdAt = data.createdAt;
  }

  /**
   * Maps a Prisma `Notification` row to the public DTO.
   *
   * @param {Notification} notification - Prisma notification entity.
   * @returns {NotificationDTO} API-safe notification object.
   */
  static build(notification: Notification): NotificationDTO {
    return new NotificationDTO({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    });
  }
}
