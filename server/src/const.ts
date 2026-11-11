export const corsWhiteList = [
  'http://localhost:5173',
  'http://localhost:5179',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://localhost:3006',
  'http://localhost:3007',
  'http://localhost:3008',
  'http://10.10.10.26:3008',
  'http://10.10.10.26:3000',
  'http://10.10.10.27:3008',
  'http://10.10.10.27:3001',
  'https://api.allround.com',
  'http://localhost:5000',
  'http://localhost:5001',
  'http://localhost:5002',
  'http://localhost:5003',
  'http://localhost:5004',
  'http://localhost:5005',
  'http://localhost:5006',
  'http://localhost:5007',
  'http://localhost:5008',
  'https://jump-look-speech-cam.trycloudflare.com',
  'https://jump-look-speech-cam.trycloudflare.com',
  'https://allround.localbox.online',
  'http://localhost:5173',
  'https://allround-admin.localbox.online',
  'https://allround.localbox.online',
];
export const saltRound = 10;
export const emailRegex = /^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/;
export const baseUrl = {
  v1: '/api/v1',
  v2: '/api/v2',
};

/** ==================================
 * -------- EXPIRE TIME --------
 * ===================================
 */

export const otpPageTokenExpireIn = '1d';
export const userAccessTokenExpiresIn = '30d';
export const adminAccessTokenExpiresIn = '15m';
export const resetOtpPageTokenExpiresIn = '15m';
export const refreshTokenExpiresInWithOutRememberMe = '3d';
export const refreshTokenExpiresInWithRememberMe = '30d';
export const otpExpireAt = 4;
export const locationExpireAt = 1;

/** ==================================
 * ---------- DEFAULT VALUES ---------
 * ===================================
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;

export const isoUtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export const SOCKET_EVENTS = {
  // ===== Conversation Management =====
  // Client → Server
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',

  // Server → Client
  CONVERSATION_JOINED: 'conversation:joined',
  CONVERSATION_LEFT: 'conversation:left',

  // ===== Messaging =====
  // Client → Server
  MESSAGE_READ: 'message:read',

  // Server → Client
  MESSAGE_READ_RESPONSE: 'message:read-response',
  NEW_MESSAGE: 'new_message',
  NEW_CONVERSATION: 'new_conversation',

  // ===== Typing =====
  // Client → Server
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  // Server → Client
  TYPING_START_RESPONSE: 'typing:start-response',
  TYPING_STOP_RESPONSE: 'typing:stop-response',

  // ===== Notifications =====
  // Client → Server
  NOTIFICATION_COUNT: 'notification:count',
  NOTIFICATION_MARK_READ: 'notification:mark-read',
  NOTIFICATION_MARK_ALL_READ: 'notification:mark-all-read',

  // Server → Client
  NOTIFICATION_COUNT_RESPONSE: 'notification:count-response',
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_ALL_READ: 'notification:all-read',

  // ===== Common =====
  ERROR: 'error:server',
  MESSAGE_ERROR: 'message:error',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export const allowedAttachmentMimeTypes = [
  // =========================
  // Images
  // =========================
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/x-ms-bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/x-icon',
  'image/vnd.microsoft.icon',

  // =========================
  // PDF
  // =========================
  'application/pdf',

  // =========================
  // Microsoft Word
  // =========================
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  // =========================
  // Microsoft Excel
  // =========================
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  // =========================
  // Microsoft PowerPoint
  // =========================
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // =========================
  // Text
  // =========================
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/rtf',

  // =========================
  // JSON / XML
  // =========================
  'application/json',
  'application/xml',
  'text/xml',

  // =========================
  // Archives
  // =========================
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-tar',

  // =========================
  // Audio
  // =========================
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'audio/x-m4a',

  // =========================
  // Video
  // =========================
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'video/webm',
  'video/ogg',
  'video/x-matroska',
  'video/3gpp',
  'video/3gpp2',

  // =========================
  // Adobe
  // =========================
  'application/postscript',

  // =========================
  // OpenDocument
  // =========================
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',

  // =========================
  // Apple iWork
  // =========================
  'application/vnd.apple.pages',
  'application/vnd.apple.numbers',
  'application/vnd.apple.keynote',
] as const;

export const allowedExtensions = [
  // Images
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.bmp',
  '.tiff',
  '.heic',
  '.heif',
  '.avif',

  // Documents
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.md',
  '.rtf',
  '.json',
  '.xml',

  // Archives
  '.zip',
  '.rar',
  '.7z',
  '.gz',
  '.tar',

  // Audio
  '.mp3',
  '.wav',
  '.ogg',
  '.aac',
  '.flac',
  '.m4a',

  // Video
  '.mp4',
  '.mov',
  '.avi',
  '.wmv',
  '.mkv',
  '.webm',
  '.mpeg',
  '.3gp',

  // OpenDocument
  '.odt',
  '.ods',
  '.odp',

  // Apple iWork
  '.pages',
  '.numbers',
  '.key',
] as const;

/**
 * ==============================================
 * ------------------REDIS KEYS------------------
 * ==============================================
 */

/**
 * ⚠️ DEVELOPER NOTICE: REDIS KEY PREFIXES
 *
 * Rules for adding new prefixes:
 * 1. DO NOT include a trailing colon (:) at the end of the string.
 * 2. The `createRedisKey` utility automatically manages colon separators.
 *
 * Adding a trailing colon here will cause broken keys like 'user:otp::12345'.
 */
export const REDIS_PREFIXES = {
  otp: 'user:otp',
  blacklist: 'blacklist:token',
  location: 'user:location',
  locations: 'users:locations',
  adminSession: 'admin:session',
  connectOnboarding: 'connect:onboarding',
} as const;

/**
 * ==============================================
 * ------------------QUEUE JOBS------------------
 * ==============================================
 * ⚠️ DEVELOPER NOTICE: AUTOGENERATED SECTION
 * Do not modify this section manually. It is automatically updated by the create:queue-job script.
 */
export const QUEUE_JOBS = {
  // AUTO-GENERATED-JOBS-START
  RESET_RECOVER_USER_PASSWORD_SUCCESSFUL: 'reset-recover-user-password-successful',
  SIGNUP_USER_VERIFICATION_SUCCESSFUL: 'signup-user-verification-successful',
  RESEND_OTP: 'resend-otp',
  ACCOUNT_CREATE_SUCCESS: 'account-create-success',
  
  // AUTO-GENERATED-JOBS-END
} as const;

/**
 * ==============================================
 * ------------------AUTH ERROR TYPES------------
 * ==============================================
 */

export enum AuthErrorType {
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_BLACKLISTED = 'TOKEN_BLACKLISTED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  DUPLICATE_DATA = 'DUPLICATE_DATA',
  OTP_EXPIRED = 'OTP_EXPIRED',
  INVALID_OTP = 'INVALID_OTP',
  ACCESS_DENIED = 'ACCESS_DENIED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  CUSTOMER_NOT_FOUND = 'CUSTOMER_NOT_FOUND',
  INSPECTION_NOT_FOUND = 'INSPECTION_NOT_FOUND',
  INSPECTION_ALREADY_CONVERTED = 'INSPECTION_ALREADY_CONVERTED',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  PHASE_NOT_FOUND = 'PHASE_NOT_FOUND',
  INVALID_DEVICE_CONTEXT = 'INVALID_DEVICE_CONTEXT',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  DEVICE_NOT_OWNED = 'DEVICE_NOT_OWNED',
  SESSION_LOGGED_OUT = 'SESSION_LOGGED_OUT',
  SESSION_REVOKED = 'SESSION_REVOKED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  FORBIDDEN = 'FORBIDDEN',
  BAD_REQUEST = 'BAD_REQUEST',
}

export enum SystemErrorType {
  INVALID_JSON_PAYLOAD = 'INVALID_JSON',
  INTERNAL_SERVER_ERROR = 'SERVER_ERROR',
}

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  RECOVER_PAGE_TOKEN: 'recover_page_token',
  ADMIN_CSRF_TOKEN: 'admin_csrf_token',
} as const;
