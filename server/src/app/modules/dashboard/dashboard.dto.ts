import { PhaseType } from '@prisma/client';
import type { ILocalizationMeta } from '@/app/services/translation/translation.types';

/**
 * KPI counters for the admin home dashboard cards.
 */
export class AdminDashboardStatsDTO {
  /**
   * @param {number} plannedErections - ERECTION phases in planned statuses.
   * @param {number} erectionInProgress - ERECTION phases with `IN_PROGRESS`.
   * @param {number} standingScaffolds - Distinct projects with an active STANDING phase.
   * @param {number} plannedDismantling - DISMANTLING phases in planned statuses.
   * @param {number} dismantlingInProgress - DISMANTLING phases with `IN_PROGRESS`.
   * @param {number} inspectionDue - Global pending inspections.
   */
  constructor(
    public plannedErections: number,
    public erectionInProgress: number,
    public standingScaffolds: number,
    public plannedDismantling: number,
    public dismantlingInProgress: number,
    public inspectionDue: number
  ) {}
}

/**
 * Map legend counts by active pin phase type.
 */
export class AdminDashboardMapCountsDTO {
  /**
   * @param {number} erection - Pins with active ERECTION phase.
   * @param {number} standing - Pins with active STANDING phase.
   * @param {number} dismantling - Pins with active DISMANTLING phase.
   */
  constructor(
    public erection: number,
    public standing: number,
    public dismantling: number
  ) {}
}

/**
 * Admin map pin for a project with an active phase.
 */
export class AdminDashboardMapPinDTO {
  /** Alua localization metadata for project name. */
  localization?: ILocalizationMeta;

  /**
   * @param {string} projectId - Project UUID.
   * @param {string} name - Project name.
   * @param {{ lat: number; lng: number } | null} coordinates - Geo coordinates.
   * @param {PhaseType} phaseType - Active phase type used for pin color.
   */
  constructor(
    public projectId: string,
    public name: string,
    public coordinates: { lat: number; lng: number } | null,
    public phaseType: PhaseType
  ) {}
}

/**
 * Map section: legend counts + pins.
 */
export class AdminDashboardMapDTO {
  /**
   * @param {AdminDashboardMapCountsDTO} counts - Legend badge counts.
   * @param {AdminDashboardMapPinDTO[]} pins - Distinct project pins.
   */
  constructor(
    public counts: AdminDashboardMapCountsDTO,
    public pins: AdminDashboardMapPinDTO[]
  ) {}
}

/**
 * One row in the "Today's operations" table.
 */
export class AdminTodaysOperationDTO {
  /** Alua localization metadata for projectName. */
  projectLocalization?: ILocalizationMeta;
  /** Customer UUID (for translation lookups). */
  customerId?: string;
  /** Alua localization metadata for customerName. */
  customerLocalization?: ILocalizationMeta;
  /** Primary project manager user id when present. */
  managerId?: string | null;
  /** Alua localization metadata for managerName. */
  managerLocalization?: ILocalizationMeta;

  /**
   * @param {string} phaseId - Phase UUID.
   * @param {string} projectId - Project UUID.
   * @param {string} projectName - Project display name.
   * @param {string} customerName - Customer display name.
   * @param {string | null} managerName - Primary project manager display name.
   * @param {PhaseType} phaseType - Phase type badge.
   * @param {number} crewCount - Crew assigned for today.
   */
  constructor(
    public phaseId: string,
    public projectId: string,
    public projectName: string,
    public customerName: string,
    public managerName: string | null,
    public phaseType: PhaseType,
    public crewCount: number
  ) {}
}

/**
 * Full admin home dashboard payload.
 */
export class AdminDashboardDTO {
  /**
   * @param {AdminDashboardStatsDTO} stats - KPI cards.
   * @param {AdminDashboardMapDTO} map - Map pins + legend counts.
   * @param {AdminTodaysOperationDTO[]} todaysOperations - Paginated today's jobs.
   */
  constructor(
    public stats: AdminDashboardStatsDTO,
    public map: AdminDashboardMapDTO,
    public todaysOperations: AdminTodaysOperationDTO[]
  ) {}
}
