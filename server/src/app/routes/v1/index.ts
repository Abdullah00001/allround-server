import { Router } from 'express';

const routes: Router[] = [];

const v1Routes = Router();

routes.forEach((route) => v1Routes.use(route));

export default v1Routes;
