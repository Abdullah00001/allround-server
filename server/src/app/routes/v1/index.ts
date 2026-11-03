import { Router } from 'express';
import authRoutes from '@/app/modules/auth/auth.routes';

const routes: Router[] = [
  authRoutes,];

const v1Routes = Router();

routes.forEach((route) => v1Routes.use(route));

export default v1Routes;
