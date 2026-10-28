import { Profile, User, Device, ServiceCharge, ClubPackage, Event, ClubOpeningHour } from '@prisma/client';
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
      profile:Profile
      device?: Device;
      serviceCharge: ServiceCharge;
      validatedQuery?: unknown;
      connectCallbackUserId: string;
      purchaseIdempotencyKey: string;
      purchaseClubPackage?: ClubPackage & { club: { clubOpeningHours: ClubOpeningHour[] } };
      purchaseEvent?: Event;
      purchaseBuyerAge?: number;
    }
  }
}
