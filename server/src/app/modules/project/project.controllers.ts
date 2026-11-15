import { Request, Response } from 'express';
import {
  Attachment,
  Project,
  ProjectMeasurement,
  ProjectNote,
  ProjectPhase,
  ProjectTask,
  User,
} from '@prisma/client';
import { getTraceId } from '@/app/configs/requestContext.configs';
import { asyncHandler } from '@/app/utils/system.utils';
import { buildPaginationMeta } from '@/app/utils/pagination.utils';
import {
  createPhaseService,
  deleteProjectService,
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
import {
  createMobileProjectService,
  createProjectAttachmentService,
  createProjectMeasurementService,
  createProjectNoteService,
  createProjectTaskService,
  deleteProjectAttachmentService,
  deleteProjectMeasurementService,
  deleteProjectNoteService,
  deleteProjectTaskService,
  getMobileProjectByIdService,
  listProjectAttachmentsService,
  listProjectHistoryService,
  listProjectMeasurementsService,
  listProjectNotesService,
  listProjectTasksService,
  setProjectAttachmentCoverService,
  toggleProjectTaskService,
  updatePhaseDatesService,
  updateProjectMeasurementService,
  updateProjectNoteService,
} from '@/app/modules/mobile/mobile.services';
import {
  TCreateMeasurementPayload,
  TCreateMobileProjectPayload,
  TCreateProjectAttachmentPayload,
  TCreateProjectNotePayload,
  TCreateProjectTaskPayload,
  TGetProjectAttachmentsQuery,
  TGetProjectListQuery,
  TGetProjectTasksQuery,
  TUpdateMeasurementPayload,
  TUpdatePhaseDatesPayload,
  TUpdateProjectNotePayload,
} from '@/app/modules/mobile/mobile.types';

/**
 * Handles `GET /admin/projects`.
 * Returns phase-centric cards with tab counts (admin Projects UI).
 *
 * @param {Request} req - Express request with `validatedQuery`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listProjectsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const query = req.validatedQuery as TGetProjectsQuery;
    const { data, total, page, limit } = await listProjectsService({ query });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Projects fetched successfully.',
      meta,
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/projects`.
 * Creates a project using the same service as mobile (siteManagerId required).
 *
 * @param {Request} req - Express request with body and `req.managedUser`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createProjectController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const siteManager = req.managedUser as User;
    const payload = req.body as TCreateMobileProjectPayload;
    const data = await createMobileProjectService({
      user,
      siteManager,
      payload,
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/projects/:id`.
 * Returns the mobile project hub DTO (Overview / tabs parity).
 *
 * @param {Request} req - Express request with trusted `req.project`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const getProjectByIdController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const data = await getMobileProjectByIdService({ user, project });

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
 * Handles `PATCH /admin/projects/:id` (Edit Master Data).
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
 * Handles `DELETE /admin/projects/:id` (soft delete).
 *
 * @param {Request} req - Express request with trusted `req.project`.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteProjectController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const data = await deleteProjectService({ project });

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/projects/:id/phases`.
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

/**
 * Handles `PATCH /admin/projects/:projectId/phases/:phaseId/dates`.
 *
 * @param {Request} req - Express request with trusted phase and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updatePhaseDatesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const phase = req.phase as ProjectPhase;
    const payload = req.body as TUpdatePhaseDatesPayload;
    const data = await updatePhaseDatesService({ phase, payload });

    res.status(200).json({
      success: true,
      message: 'Phase dates updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/projects/:projectId/tasks`.
 *
 * @param {Request} req - Express request with trusted project.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listProjectTasksController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const query = req.validatedQuery as TGetProjectTasksQuery;
    const { data, total, page, limit } = await listProjectTasksService({
      user,
      project,
      query,
    });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Project tasks fetched successfully.',
      meta,
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/projects/:projectId/tasks`.
 *
 * @param {Request} req - Express request with trusted project and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createProjectTaskController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const payload = req.body as TCreateProjectTaskPayload;
    const data = await createProjectTaskService({ user, project, payload });

    res.status(201).json({
      success: true,
      message: 'Project task created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/tasks/:taskId/toggle`.
 *
 * @param {Request} req - Express request with trusted task.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const toggleProjectTaskController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const task = req.projectTask as ProjectTask;
    const data = await toggleProjectTaskService({ task });

    res.status(200).json({
      success: true,
      message: 'Project task toggled successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /admin/tasks/:taskId`.
 *
 * @param {Request} req - Express request with trusted task.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteProjectTaskController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const task = req.projectTask as ProjectTask;
    const data = await deleteProjectTaskService({ task });

    res.status(200).json({
      success: true,
      message: 'Project task deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/projects/:projectId/measurements`.
 *
 * @param {Request} req - Express request with trusted project.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listProjectMeasurementsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const query = req.validatedQuery as TGetProjectListQuery;
    const { data, total, page, limit } = await listProjectMeasurementsService({
      user,
      project,
      query,
    });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Project measurements fetched successfully.',
      meta,
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/projects/:projectId/measurements`.
 *
 * @param {Request} req - Express request with trusted project and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createProjectMeasurementController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const payload = req.body as TCreateMeasurementPayload;
    const data = await createProjectMeasurementService({
      project,
      payload,
    });

    res.status(201).json({
      success: true,
      message: 'Project measurement created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/projects/:projectId/measurements/:id`.
 *
 * @param {Request} req - Express request with trusted measurement and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateProjectMeasurementController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const measurement = req.projectMeasurement as ProjectMeasurement;
    const payload = req.body as TUpdateMeasurementPayload;
    const data = await updateProjectMeasurementService({
      project,
      measurement,
      payload,
    });

    res.status(200).json({
      success: true,
      message: 'Project measurement updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /admin/projects/:projectId/measurements/:id`.
 *
 * @param {Request} req - Express request with trusted measurement.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteProjectMeasurementController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const measurement = req.projectMeasurement as ProjectMeasurement;
    const data = await deleteProjectMeasurementService({
      project,
      measurement,
    });

    res.status(200).json({
      success: true,
      message: 'Project measurement deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/projects/:projectId/notes`.
 *
 * @param {Request} req - Express request with trusted project.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listProjectNotesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const query = req.validatedQuery as TGetProjectListQuery;
    const { items, total, page, limit } = await listProjectNotesService({
      user,
      project,
      query,
    });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Project notes fetched successfully.',
      meta,
      data: items,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/projects/:projectId/notes`.
 *
 * @param {Request} req - Express request with trusted project and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createProjectNoteController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const payload = req.body as TCreateProjectNotePayload;
    const data = await createProjectNoteService({ user, project, payload });

    res.status(201).json({
      success: true,
      message: 'Project note created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/projects/:projectId/notes/:id`.
 *
 * @param {Request} req - Express request with trusted note and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const updateProjectNoteController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const note = req.projectNote as ProjectNote;
    const payload = req.body as TUpdateProjectNotePayload;
    const data = await updateProjectNoteService({ note, payload });

    res.status(200).json({
      success: true,
      message: 'Project note updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /admin/projects/:projectId/notes/:id`.
 *
 * @param {Request} req - Express request with trusted note.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteProjectNoteController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const note = req.projectNote as ProjectNote;
    const data = await deleteProjectNoteService({ note });

    res.status(200).json({
      success: true,
      message: 'Project note deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/projects/:projectId/attachments`.
 *
 * @param {Request} req - Express request with trusted project.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listProjectAttachmentsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const query = req.validatedQuery as TGetProjectAttachmentsQuery;
    const { items, total, page, limit } = await listProjectAttachmentsService({
      project,
      query,
    });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Project attachments fetched successfully.',
      meta,
      data: items,
      traceId,
    });
    return;
  }
);

/**
 * Handles `POST /admin/projects/:projectId/attachments`.
 *
 * @param {Request} req - Express request with trusted project and body.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const createProjectAttachmentController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const payload = req.body as TCreateProjectAttachmentPayload;
    const data = await createProjectAttachmentService({ project, payload });

    res.status(201).json({
      success: true,
      message: 'Project attachment created successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `PATCH /admin/projects/:projectId/attachments/:id/cover`.
 *
 * @param {Request} req - Express request with trusted PHOTO attachment.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const setProjectAttachmentCoverController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const project = req.project as Project;
    const attachment = req.attachment as Attachment;
    const data = await setProjectAttachmentCoverService({
      project,
      attachment,
    });

    res.status(200).json({
      success: true,
      message: 'Project cover updated successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `DELETE /admin/projects/:projectId/attachments/:id`.
 *
 * @param {Request} req - Express request with trusted attachment.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const deleteProjectAttachmentController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const attachment = req.attachment as Attachment;
    const data = await deleteProjectAttachmentService({ attachment });

    res.status(200).json({
      success: true,
      message: 'Project attachment deleted successfully.',
      data,
      traceId,
    });
    return;
  }
);

/**
 * Handles `GET /admin/projects/:projectId/history`.
 *
 * @param {Request} req - Express request with trusted project.
 * @param {Response} res - Express response.
 * @returns {Promise<void>}
 */
export const listProjectHistoryController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const traceId = getTraceId();
    const user = req.user as User;
    const project = req.project as Project;
    const query = req.validatedQuery as TGetProjectListQuery;
    const { items, total, page, limit } = await listProjectHistoryService({
      user,
      project,
      query,
    });
    const meta = buildPaginationMeta({ total, page, limit, req });

    res.status(200).json({
      success: true,
      message: 'Project history fetched successfully.',
      meta,
      data: items,
      traceId,
    });
    return;
  }
);
