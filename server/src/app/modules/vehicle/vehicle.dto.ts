import { Vehicle } from '@prisma/client';

/**
 * Standard vehicle response DTO (omits `deletedAt`).
 */
export class VehicleDTO {
  /**
   * @param {string} id - Vehicle UUID.
   * @param {string} name - Display name.
   * @param {string} plateNumber - Unique license plate.
   * @param {string | null} imageUrl - Optional image URL.
   * @param {string} createdAt - ISO creation timestamp.
   * @param {string} updatedAt - ISO update timestamp.
   */
  constructor(
    public id: string,
    public name: string,
    public plateNumber: string,
    public imageUrl: string | null,
    public createdAt: string,
    public updatedAt: string
  ) {}

  /**
   * Builds a vehicle DTO from a Prisma `Vehicle`.
   *
   * @param {Vehicle} vehicle - Vehicle entity.
   * @returns {VehicleDTO} API-safe vehicle object.
   */
  static build(vehicle: Vehicle) {
    return new VehicleDTO(
      vehicle.id,
      vehicle.name,
      vehicle.plateNumber,
      vehicle.imageUrl,
      vehicle.createdAt.toISOString(),
      vehicle.updatedAt.toISOString()
    );
  }
}
