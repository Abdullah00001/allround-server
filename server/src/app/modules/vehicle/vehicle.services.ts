import { Prisma } from '@prisma/client';
import prisma from '@/app/configs/db.configs';
import { VehicleDTO } from '@/app/modules/vehicle/vehicle.dto';
import {
  TCreateVehicleServiceParams,
  TDeleteVehicleServiceParams,
  TListVehiclesServiceParams,
  TUpdateVehicleServiceParams,
} from '@/app/modules/vehicle/vehicle.types';

/**
 * Creates a new vehicle.
 * Assumes plate uniqueness was already enforced by middleware.
 *
 * @param {TCreateVehicleServiceParams} params - Validated create payload wrapper.
 * @returns {Promise<VehicleDTO>} Created vehicle DTO.
 */
export const createVehicleService = async ({
  payload,
}: TCreateVehicleServiceParams): Promise<VehicleDTO> => {
  const vehicle = await prisma.vehicle.create({
    data: {
      name: payload.name,
      plateNumber: payload.plateNumber,
      imageUrl: payload.imageUrl,
    },
  });

  return VehicleDTO.build(vehicle);
};

/**
 * Lists non-deleted vehicles with optional name/plate search and pagination.
 *
 * @param {TListVehiclesServiceParams} params - Validated query wrapper.
 * @returns {Promise<{ items: VehicleDTO[]; total: number; page: number; limit: number }>}
 * Paginated vehicle DTOs plus total for meta construction.
 */
export const listVehiclesService = async ({
  query,
}: TListVehiclesServiceParams): Promise<{
  items: VehicleDTO[];
  total: number;
  page: number;
  limit: number;
}> => {
  const { page, limit, search } = query;

  const where: Prisma.VehicleWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { plateNumber: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, vehicles] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    items: vehicles.map(VehicleDTO.build),
    total,
    page,
    limit,
  };
};

/**
 * Updates a non-deleted vehicle.
 *
 * @param {TUpdateVehicleServiceParams} params - Trusted vehicle and payload.
 * @returns {Promise<VehicleDTO>} Updated vehicle DTO.
 */
export const updateVehicleService = async ({
  vehicle,
  payload,
}: TUpdateVehicleServiceParams): Promise<VehicleDTO> => {
  const updated = await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.plateNumber !== undefined
        ? { plateNumber: payload.plateNumber }
        : {}),
      ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
    },
  });

  return VehicleDTO.build(updated);
};

/**
 * Soft-deletes a vehicle by setting `deletedAt`.
 *
 * @param {TDeleteVehicleServiceParams} params - Trusted vehicle wrapper.
 * @returns {Promise<{ id: string }>} Soft-deleted vehicle id.
 */
export const deleteVehicleService = async ({
  vehicle,
}: TDeleteVehicleServiceParams): Promise<{ id: string }> => {
  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: { deletedAt: new Date() },
  });

  return { id: vehicle.id };
};
