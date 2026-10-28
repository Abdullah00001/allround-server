export type TEnv = {
  NODE_ENV: string;
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PASSWORD: string;
  REDIS_PORT: number;
  FIREBASE_ACCOUNT_TYPE: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_ID: string;
  FIREBASE_AUTH_URI: string;
  FIREBASE_TOKEN_URI: string;
  FIREBASE_AUTH_PROVIDER_X509_CERT_URL: string;
  FIREBASE_CLIENT_X509_CERT_URL: string;
  FIREBASE_UNIVERSE_DOMAIN: string;
  FIREBASE_CLIENT_EMAIL: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  S3_REGION: string;
  S3_ENDPOINT: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_BUCKET_NAME: string;
  S3_PUBLIC_URL: string;
  STRIPE_SECRET_KEY: string;
  SERVER_URL: string;
};

export type TMailOption = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

export type TFirebaseCredentials = {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
  client_email: string;
};
