import { hash } from 'bcrypt';
import { PrismaClient, type Prisma } from '@prisma/client';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

type TxClient = Prisma.TransactionClient;

/**
 * Returns a Date at UTC midnight for the given calendar day offset from today.
 */
function dayAtUtcMidnight(dayOffset: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset)
  );
}

/**
 * Hashes a plain-text password with bcrypt using the project salt rounds.
 */
async function hashSeedPassword(plain: string): Promise<string> {
  return hash(plain, SALT_ROUNDS);
}

/**
 * Deletes all seedable tables in reverse dependency order so re-runs stay idempotent.
 */
async function clearDatabase(tx: TxClient): Promise<void> {
  await tx.timeLogBreak.deleteMany();
  await tx.timeLog.deleteMany();
  await tx.crewAssignment.deleteMany();
  await tx.vehicleAssignment.deleteMany();
  await tx.attachment.deleteMany();
  await tx.projectTask.deleteMany();
  await tx.projectNote.deleteMany();
  await tx.projectMeasurement.deleteMany();
  await tx.auditLog.deleteMany();
  await tx.notification.deleteMany();
  await tx.device.deleteMany();
  await tx.userPreference.deleteMany();
  await tx.absence.deleteMany();
  await tx.projectManagerAssignment.deleteMany();
  await tx.projectPhase.deleteMany();
  await tx.inspection.deleteMany();
  await tx.project.deleteMany();
  await tx.customerContact.deleteMany();
  await tx.customer.deleteMany();
  await tx.vehicle.deleteMany();
  await tx.legalContent.deleteMany();
  await tx.systemSetting.deleteMany();
  await tx.companyProfile.deleteMany();
  await tx.user.deleteMany();
}

/**
 * Seeds the singleton company profile and legal documents.
 */
async function seedSystemSettings(tx: TxClient): Promise<void> {
  await tx.companyProfile.create({
    data: {
      id: 'global',
      displayName: 'Allround Cockpit',
      officialName: 'Allround Gerüstbau GmbH',
      defaultLanguage: 'DE',
      enabledLanguages: ['DE', 'EN'],
      siteManagerAccessRule: 'RESTRICT_TO_ASSIGNED',
    },
  });

  await tx.legalContent.createMany({
    data: [
      {
        legalContentType: 'PRIVACY_AND_POLICY',
        content:
          'This is dummy Privacy Policy content for local development and QA. Replace with production legal text before go-live.',
      },
      {
        legalContentType: 'TERMS_AND_CONDITION',
        content:
          'This is dummy Terms & Conditions content for local development and QA. Replace with production legal text before go-live.',
      },
    ],
  });
}

/**
 * Seeds the three canonical ACTIVE users with preferences and hashed passwords.
 */
async function seedUsers(
  tx: TxClient,
  passwords: { admin: string; manager: string; employee: string }
) {
  const admin = await tx.user.create({
    data: {
      email: 'admin@allround.com',
      passwordHash: passwords.admin,
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      isProfileSetup: true,
      isLegalTermAccepted: true,
      preferences: {
        create: {
          language: 'DE',
        },
      },
    },
  });

  const manager = await tx.user.create({
    data: {
      email: 'manager@allround.com',
      passwordHash: passwords.manager,
      firstName: 'Klaus',
      lastName: 'Berger',
      role: 'SITE_MANAGER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      isProfileSetup: true,
      isLegalTermAccepted: true,
      preferences: {
        create: {
          language: 'DE',
        },
      },
    },
  });

  const employee = await tx.user.create({
    data: {
      email: 'employee@allround.com',
      passwordHash: passwords.employee,
      firstName: 'Anna',
      lastName: 'Schmidt',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      isProfileSetup: true,
      isLegalTermAccepted: true,
      preferences: {
        create: {
          language: 'DE',
        },
      },
    },
  });

  return { admin, manager, employee };
}

/**
 * Seeds demo customers and a primary contact for Bayer AG.
 */
async function seedCustomersAndContacts(tx: TxClient) {
  const bayer = await tx.customer.create({
    data: {
      name: 'Bayer AG',
      category: 'COMMERCIAL',
      address: 'Kaiser-Wilhelm-Allee 1, 51373 Leverkusen',
      latitude: 51.0137,
      longitude: 6.9842,
      contacts: {
        create: {
          name: 'Dr. Thomas Klein',
          role: 'Primary Contact',
          email: 'thomas.klein@bayer.example',
          phone: '+492143012345',
          isPrimary: true,
        },
      },
    },
  });

  const stadtKoeln = await tx.customer.create({
    data: {
      name: 'Stadt Köln',
      category: 'MUNICIPALITY',
      address: 'Rathausplatz 1, 50667 Köln',
      latitude: 50.9381,
      longitude: 6.9599,
    },
  });

  return { bayer, stadtKoeln };
}

/**
 * Seeds demo projects, phases, manager assignment, and crew assignment.
 */
async function seedProjectsPhasesAndAssignments(
  tx: TxClient,
  args: {
    bayerId: string;
    stadtKoelnId: string;
    managerId: string;
    employeeId: string;
    today: Date;
    tomorrow: Date;
  }
) {
  const project1 = await tx.project.create({
    data: {
      customerId: args.bayerId,
      name: 'Golsteins.Complex',
      address: 'Golsteinstraße 12, 50968 Köln',
      latitude: 50.92,
      longitude: 6.95,
      budgetedHours: 160,
      phases: {
        create: [
          {
            type: 'ERECTION',
            status: 'IN_PROGRESS',
            startDate: args.today,
            endDate: args.tomorrow,
          },
          {
            type: 'DISMANTLING',
            status: 'ENQUIRY',
          },
        ],
      },
    },
    include: {
      phases: true,
    },
  });

  const project2 = await tx.project.create({
    data: {
      customerId: args.stadtKoelnId,
      name: 'Rheinpark Tower',
      address: 'Rheinparkweg 1, 50679 Köln',
      latitude: 50.9413,
      longitude: 6.9745,
      budgetedHours: 0,
    },
  });

  await tx.projectManagerAssignment.create({
    data: {
      projectId: project1.id,
      userId: args.managerId,
    },
  });

  const erectionPhase = project1.phases.find((phase) => phase.type === 'ERECTION');
  if (!erectionPhase) {
    throw new Error('Expected ERECTION phase for Golsteins.Complex');
  }

  await tx.crewAssignment.create({
    data: {
      phaseId: erectionPhase.id,
      userId: args.employeeId,
      date: args.today,
      hours: 8,
    },
  });

  return { project1, project2, erectionPhase };
}

/**
 * Seeds a pending inspection linked to Bayer AG and the site manager.
 */
async function seedInspections(
  tx: TxClient,
  args: {
    bayerId: string;
    managerId: string;
    tomorrow: Date;
  }
) {
  return tx.inspection.create({
    data: {
      customerId: args.bayerId,
      siteManagerId: args.managerId,
      siteTitle: 'Deutz Warehouse',
      address: 'Deutz-Mülheimer Straße 129, 51063 Köln',
      postalCode: '51063',
      city: 'Köln',
      appointmentDate: args.tomorrow,
      status: 'PENDING',
    },
  });
}

/**
 * Clears the database and inserts the full demo dataset inside one transaction.
 */
async function seed(): Promise<void> {
  const today = dayAtUtcMidnight(0);
  const tomorrow = dayAtUtcMidnight(1);

  const [adminHash, managerHash, employeeHash] = await Promise.all([
    hashSeedPassword('Admin123!'),
    hashSeedPassword('Manager123!'),
    hashSeedPassword('Employee123!'),
  ]);

  await prisma.$transaction(
    async (tx) => {
      await clearDatabase(tx);
      await seedSystemSettings(tx);

      const { manager, employee } = await seedUsers(tx, {
        admin: adminHash,
        manager: managerHash,
        employee: employeeHash,
      });

      const { bayer, stadtKoeln } = await seedCustomersAndContacts(tx);

      await seedProjectsPhasesAndAssignments(tx, {
        bayerId: bayer.id,
        stadtKoelnId: stadtKoeln.id,
        managerId: manager.id,
        employeeId: employee.id,
        today,
        tomorrow,
      });

      await seedInspections(tx, {
        bayerId: bayer.id,
        managerId: manager.id,
        tomorrow,
      });
    },
    { timeout: 60_000 }
  );
}

/**
 * Entry point for `prisma db seed`.
 */
async function main(): Promise<void> {
  console.log('Seeding database...');
  await seed();
  console.log('Seed completed successfully.');
  console.log('Users:');
  console.log('  admin@allround.com / Admin123!');
  console.log('  manager@allround.com / Manager123!');
  console.log('  employee@allround.com / Employee123!');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
