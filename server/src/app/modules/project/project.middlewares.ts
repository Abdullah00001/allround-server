import { NextFunction, Request, Response } from 'express';
import { Project, ProjectPhase } from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import prisma from '@/app/configs/db.configs';
import { AuthErrorType } from '@/const';

/**
 * Verifies that a non-soft-deleted project exists for `req.params.id`.
 * Attaches the Prisma `Project` to `req.project` on success.
 *
 * @param {Request} req - Express request with validated `params.id`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the project exists.
 * @returns {Promise<void>}
 */
export const checkProjectExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const projectId = req.params.id as string;

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
        errorType: AuthErrorType.PROJECT_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.project = project as Project;
    next();
  }
);

/**
 * Verifies that a project phase exists for `req.params.phaseId`.
 * Attaches the Prisma `ProjectPhase` to `req.phase` on success.
 *
 * @param {Request} req - Express request with validated `params.phaseId`.
 * @param {Response} res - Express response used for the 404 envelope.
 * @param {NextFunction} next - Continues when the phase exists.
 * @returns {Promise<void>}
 */
export const checkPhaseExistenceMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const traceId = getTraceId();
    const phaseId = req.params.phaseId as string;

    const phase = await prisma.projectPhase.findUnique({
      where: { id: phaseId },
    });

    if (!phase) {
      res.status(404).json({
        success: false,
        message: 'Phase not found',
        errorType: AuthErrorType.PHASE_NOT_FOUND,
        traceId,
      });
      return;
    }

    req.phase = phase as ProjectPhase;
    next();
  }
);
