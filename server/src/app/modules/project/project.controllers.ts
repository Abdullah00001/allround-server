import { Request, Response } from 'express';
import { Project, ProjectPhase, User } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { buildPaginationMeta } from '@/app/utils/pagination.utils';
import {
  createPhaseService,
  getProjectByIdService,
  listProjectsService,
  updatePhaseStatusService,
  updateProjectService,
} from '@/app/modules/project/project.services';
import {
  TCreatePhasePayload,
  TGetProjectsQuery,
  TUpdatePhaseStatusPayload,
  TUpdateProjectPayload,
} from '@/app/modules/project/project.types';

/**
 * Handles `GET /admin/projects`.
 * Returns a paginated project list with customer and phases.
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listProjectsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetProjectsQuery;
    const { items, total, page, limit } = await listProjectsService({ query });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Projects fetched successfully.',
      meta,
      data: items,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/projects/:id`.
 * Relies on existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.project`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getProjectByIdController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const data = await getProjectByIdService({ project });

    res.status(200).json({
      success: true,
      message: 'Project fetched successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/projects/:id`.
 * Relies on existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.project` and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateProjectController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const payload = req.body as TUpdateProjectPayload;
    const data = await updateProjectService({ project, payload });

    res.status(200).json({
      success: true,
      message: 'Project updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/projects/:id/phases`.
 * Relies on project existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.project` and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createPhaseController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const payload = req.body as TCreatePhasePayload;
    const data = await createPhaseService({ project, payload });

    res.status(201).json({
      success: true,
      message: 'Phase created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/phases/:phaseId/status`.
 * Relies on phase existence middleware for 404 handling.
 *
 * @param {Request} req - Express request with trusted `req.phase`, `req.user`, and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updatePhaseStatusController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const phase = req.phase as ProjectPhase;
    const actor = req.user as User;
    const payload = req.body as TUpdatePhaseStatusPayload;
    const data = await updatePhaseStatusService({
      phase,
      payload,
      actorUserId: actor.id,
    });

    res.status(200).json({
      success: true,
      message: 'Phase status updated successfully.',
      data,
      traceId,
    });
    return;
  }
);
