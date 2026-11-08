import { Router } from 'express';
import authRoutes from '@/app/modules/auth/auth.routes';
import adminRoutes from '@/app/modules/admin/admin.routes';
import recoverRoutes from '@/app/modules/recover/recover.routes';

const routes: Router[] = [
  recoverRoutes,
  adminRoutes,
  authRoutes,];

const v1Routes = Router();

routes.forEach((route) => v1Routes.use(route));

export default v1Routes;
