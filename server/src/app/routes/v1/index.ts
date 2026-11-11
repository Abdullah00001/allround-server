import { Router } from 'express';
import authRoutes from '@/app/modules/auth/auth.routes';
import adminRoutes from '@/app/modules/admin/admin.routes';
import recoverRoutes from '@/app/modules/recover/recover.routes';
import mediaRoutes from '@/app/modules/media/media.routes';

const routes: Router[] = [
  mediaRoutes,
  recoverRoutes,
  adminRoutes,
  authRoutes,];

const v1Routes = Router();

routes.forEach((route) => v1Routes.use(route));

export default v1Routes;
