import { Router } from 'express';
import authRoutes from '@/app/modules/auth/auth.routes';
import adminRoutes from '@/app/modules/admin/admin.routes';
import recoverRoutes from '@/app/modules/recover/recover.routes';
import mediaRoutes from '@/app/modules/media/media.routes';
import customerRoutes from '@/app/modules/customer/customer.routes';
import inspectionRoutes from '@/app/modules/inspection/inspection.routes';
import projectRoutes from '@/app/modules/project/project.routes';
import planningRoutes from '@/app/modules/planning/planning.routes';
import timelogRoutes from '@/app/modules/timelog/timelog.routes';
import absenceRoutes from '@/app/modules/absence/absence.routes';
import userRoutes from '@/app/modules/user/user.routes';
import vehicleRoutes from '@/app/modules/vehicle/vehicle.routes';
import mobileRoutes from '@/app/modules/mobile/mobile.routes';

const routes: Router[] = [
  mobileRoutes,
  vehicleRoutes,
  userRoutes,
  absenceRoutes,
  timelogRoutes,
  planningRoutes,
  projectRoutes,
  inspectionRoutes,
  customerRoutes,
  mediaRoutes,
  recoverRoutes,
  adminRoutes,
  authRoutes,];

const v1Routes = Router();

routes.forEach((route) => v1Routes.use(route));

export default v1Routes;
