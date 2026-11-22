import { Language, UserPreference } from '@prisma/client';

/**
 * Nested notification preference flags on settings responses.
 */
export class NotificationSettingsDTO {
  /**
   * @param {boolean} push - Push notifications enabled.
   * @param {boolean} email - Email notifications enabled.
   */
  constructor(
    public push: boolean,
    public email: boolean
  ) {}
}

/**
 * Mobile settings snapshot (language + notification toggles).
 */
export class SettingsDTO {
  /**
   * @param {Language} language - Preferred UI language.
   * @param {NotificationSettingsDTO} notifications - Push/email flags.
   */
  constructor(
    public language: Language,
    public notifications: NotificationSettingsDTO
  ) {}

  /**
   * Builds a settings DTO from a `UserPreference` row.
   *
   * @param {UserPreference} preferences - Preference record.
   * @returns {SettingsDTO} Response payload.
   */
  static build(preferences: UserPreference): SettingsDTO {
    return new SettingsDTO(
      preferences.language,
      new NotificationSettingsDTO(
        preferences.notificationsPush,
        preferences.notificationsEmail
      )
    );
  }
}
