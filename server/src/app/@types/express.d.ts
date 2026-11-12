import {
  Absence,
  Customer,
  Inspection,
  Notification,
  Profile,
  Project,
  ProjectPhase,
  TimeLog,
  User,
  Vehicle,
  Device,
  ServiceCharge,
  ClubPackage,
  Event,
  ClubOpeningHour,
} from '@prisma/client';
import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      fileLimit?: number;
      fieldName?: string;
      requireAtLeastOne?: boolean;
      allOptional?: boolean;
      fieldConfig?: FieldConfig[];
      fileRequired: boolean;
      files?: { [fieldname: string]: Express.Multer.File[] };
      user: JwtPayload | User;
      jwtPayload?: JwtPayload;
      profile: Profile;
      device?: Device;
      customer?: Customer;
      inspection?: Inspection;
      project?: Project;
      phase?: ProjectPhase;
      vehicle?: Vehicle;
      planningUser?: User;
      targetUser?: User;
      managedUser?: User;
      timeLog?: TimeLog;
      absence?: Absence;
      notification?: Notification;
      serviceCharge: ServiceCharge;
      validatedQuery?: unknown;
      connectCallbackUserId: string;
      purchaseIdempotencyKey: string;
      purchaseClubPackage?: ClubPackage & {
        club: { clubOpeningHours: ClubOpeningHour[] };
      };
      purchaseEvent?: Event;
      purchaseBuyerAge?: number;
    }
  }
}
