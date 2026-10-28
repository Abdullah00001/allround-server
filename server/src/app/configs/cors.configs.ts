import { CorsOptions } from 'cors';

import logger from '@/app/configs/logger.configs';
import { corsWhiteList } from '@/const';

const corsConfiguration: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || corsWhiteList.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`Blocked CORS request from origin: ${origin}`);
      callback(new Error('CORS not allowed'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'ngrok-skip-browser-warning', 'X-CSRF-Token'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200,
};

export default corsConfiguration;
