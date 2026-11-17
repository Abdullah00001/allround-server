import { hash } from 'bcrypt';
import { PrismaClient, Role, InspectionStatus, PhaseType, PhaseStatus } from '@prisma/client';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

/**
 * Returns UTC midnight with day offset.
 */
function dayAtUtcMidnight(dayOffset: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset)
  );
}

async function main() {
  console.log('--- Starting Non-Destructive Mobile Test Data Seed ---');

  const defaultPasswordHash = await hash('Employee123!', SALT_ROUNDS);

  // 1. Ensure test employees exist
  const employeeDefs = [
    {
      email: 'mesut@allround.com',
      firstName: 'Mesut',
      lastName: 'Rahaman',
      role: Role.EMPLOYEE,
    },
    {
      email: 'employee@allround.com',
      firstName: 'Anna',
      lastName: 'Schmidt',
      role: Role.EMPLOYEE,
    },
    {
      email: 'abc@yopmail.com',
      firstName: 'abc',
      lastName: 'employee',
      role: Role.EMPLOYEE,
    },
  ];

  const employees: Record<string, string> = {}; // email -> id

  for (const def of employeeDefs) {
    let user = await prisma.user.findUnique({ where: { email: def.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: def.email,
          passwordHash: defaultPasswordHash,
          firstName: def.firstName,
          lastName: def.lastName,
          role: def.role,
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
      console.log(`Created employee: ${def.email}`);
    } else {
      console.log(`Employee exists: ${def.email}`);
    }
    employees[def.email] = user.id;
  }

  // 2. Fetch site managers for inspection assignments
  const siteManagers = await prisma.user.findMany({
    where: { role: Role.SITE_MANAGER, status: 'ACTIVE' },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  console.log(`Found ${siteManagers.length} site managers to assign inspections.`);

  // 3. Fetch customers
  let bayer = await prisma.customer.findFirst({ where: { name: { contains: 'Bayer' } } });
  let stadtKoeln = await prisma.customer.findFirst({ where: { name: { contains: 'Köln' } } });

  if (!bayer) {
    bayer = await prisma.customer.create({
      data: {
        name: 'Bayer AG',
        category: 'COMMERCIAL',
        address: 'Kaiser-Wilhelm-Allee 1, 51373 Leverkusen',
        latitude: 51.0137,
        longitude: 6.9842,
      },
    });
  }

  if (!stadtKoeln) {
    stadtKoeln = await prisma.customer.create({
      data: {
        name: 'Stadt Köln',
        category: 'MUNICIPALITY',
        address: 'Rathausplatz 1, 50667 Köln',
        latitude: 50.9381,
        longitude: 6.9599,
      },
    });
  }

  // 4. Seed diverse inspections for all site managers
  const today = dayAtUtcMidnight(0);
  const tomorrow = dayAtUtcMidnight(1);
  const inThreeDays = dayAtUtcMidnight(3);

  const manager1 = siteManagers[0]?.id;
  const manager2 = siteManagers[1]?.id ?? manager1;
  const manager3 = siteManagers[2]?.id ?? manager1;

  const inspectionDefs = [
    {
      customerId: bayer.id,
      siteManagerId: manager1,
      siteTitle: 'Golstein Commercial Complex Survey',
      address: 'Golsteinstraße 12, 50968 Köln',
      postalCode: '50968',
      city: 'Köln',
      appointmentDate: today,
      scaffoldArea: 250,
      scaffoldHeight: 18.5,
      scaffoldType: 'FACADE',
      siteAccessInstructions: 'Enter via North Gate. Wear high-vis jacket and helmet.',
      specialRequirements: 'Weekend work permitted. Crane access reserved.',
      status: InspectionStatus.PENDING,
    },
    {
      customerId: stadtKoeln.id,
      siteManagerId: manager2,
      siteTitle: 'Deutz Logistics Center Roof Inspection',
      address: 'Deutz-Mülheimer Straße 129, 51063 Köln',
      postalCode: '51063',
      city: 'Köln',
      appointmentDate: today,
      scaffoldArea: 480,
      scaffoldHeight: 24.0,
      scaffoldType: 'INDUSTRIAL',
      siteAccessInstructions: 'Check in with security booth at building 4B.',
      specialRequirements: 'Special fall protection netting required on roof edges.',
      status: InspectionStatus.PENDING,
    },
    {
      customerId: bayer.id,
      siteManagerId: manager3,
      siteTitle: 'Rheinpark Tower South Elevation',
      address: 'Rheinparkweg 1, 50679 Köln',
      postalCode: '50679',
      city: 'Köln',
      appointmentDate: tomorrow,
      scaffoldArea: 320,
      scaffoldHeight: 30.0,
      scaffoldType: 'FACADE',
      siteAccessInstructions: 'Access road clear until 8:00 AM for vehicle unloading.',
      specialRequirements: 'Pedestrian tunnel scaffolding needed below walkway.',
      status: InspectionStatus.PENDING,
    },
    {
      customerId: bayer.id,
      siteManagerId: manager1,
      siteTitle: 'Leverkusen Chemical Plant Bay 4',
      address: 'Chempark Tor 1, 51368 Leverkusen',
      postalCode: '51368',
      city: 'Leverkusen',
      appointmentDate: inThreeDays,
      scaffoldArea: 180,
      scaffoldHeight: 12.0,
      scaffoldType: 'SPECIAL',
      siteAccessInstructions: 'Safety induction required at gate prior to entry.',
      specialRequirements: 'Explosion-proof grounding required.',
      status: InspectionStatus.PENDING,
    },
    {
      customerId: stadtKoeln.id,
      siteManagerId: manager2,
      siteTitle: 'Ehrenfeld Heritage Building Renovation',
      address: 'Venloer Straße 240, 50823 Köln',
      postalCode: '50823',
      city: 'Köln',
      appointmentDate: dayAtUtcMidnight(-2),
      scaffoldArea: 150,
      scaffoldHeight: 15.0,
      scaffoldType: 'FACADE',
      siteAccessInstructions: 'Key with caretaker Mr. Müller.',
      specialRequirements: 'Do not drill into historic facade stone.',
      status: InspectionStatus.SURVEY_DONE,
    },
  ];

  for (const insp of inspectionDefs) {
    const existing = await prisma.inspection.findFirst({
      where: { siteTitle: insp.siteTitle },
    });
    if (!existing) {
      await prisma.inspection.create({ data: insp });
      console.log(`Created inspection: "${insp.siteTitle}" (${insp.status}) for manager ${insp.siteManagerId}`);
    } else {
      console.log(`Inspection already exists: "${insp.siteTitle}"`);
    }
  }

  // 5. Ensure active phases and assign employees (for Upcoming Tasks)
  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    include: {
      phases: true,
      projectManagers: true,
    },
    take: 3,
  });

  if (projects.length > 0) {
    // Ensure primary project has active manager assignment
    const primaryProject = projects[0];
    if (primaryProject.projectManagers.length === 0 && siteManagers[0]) {
      await prisma.projectManagerAssignment.create({
        data: {
          projectId: primaryProject.id,
          userId: siteManagers[0].id,
        },
      });
      console.log(`Assigned primary site manager to project: ${primaryProject.name}`);
    }

    // Ensure phases exist
    let erectionPhase = primaryProject.phases.find((p) => p.type === PhaseType.ERECTION);
    if (!erectionPhase) {
      erectionPhase = await prisma.projectPhase.create({
        data: {
          projectId: primaryProject.id,
          type: PhaseType.ERECTION,
          status: PhaseStatus.IN_PROGRESS,
          startDate: today,
          endDate: tomorrow,
          durationDays: 2,
        },
      });
      console.log(`Created ERECTION phase for ${primaryProject.name}`);
    } else if (erectionPhase.status !== PhaseStatus.IN_PROGRESS) {
      await prisma.projectPhase.update({
        where: { id: erectionPhase.id },
        data: { status: PhaseStatus.IN_PROGRESS, startDate: today, endDate: tomorrow },
      });
    }

    let dismantlingPhase = primaryProject.phases.find((p) => p.type === PhaseType.DISMANTLING);
    if (!dismantlingPhase) {
      dismantlingPhase = await prisma.projectPhase.create({
        data: {
          projectId: primaryProject.id,
          type: PhaseType.DISMANTLING,
          status: PhaseStatus.ORDER_CONFIRMED,
          startDate: today,
          endDate: inThreeDays,
          durationDays: 3,
        },
      });
      console.log(`Created DISMANTLING phase for ${primaryProject.name}`);
    } else if (dismantlingPhase.status !== PhaseStatus.ORDER_CONFIRMED && dismantlingPhase.status !== PhaseStatus.IN_PROGRESS) {
      await prisma.projectPhase.update({
        where: { id: dismantlingPhase.id },
        data: { status: PhaseStatus.ORDER_CONFIRMED, startDate: today, endDate: inThreeDays },
      });
    }

    // Second project standing/erection phase
    const secondProject = projects[1] ?? primaryProject;
    let standingPhase = secondProject.phases.find((p) => p.type === PhaseType.STANDING);
    if (!standingPhase) {
      standingPhase = await prisma.projectPhase.create({
        data: {
          projectId: secondProject.id,
          type: PhaseType.STANDING,
          status: PhaseStatus.IN_PROGRESS,
          startDate: today,
          endDate: dayAtUtcMidnight(14),
          durationDays: 14,
        },
      });
      console.log(`Created STANDING phase for ${secondProject.name}`);
    }

    // Assign all test employees to these phases so their dashboard shows 3 upcoming tasks
    const phasesToAssign = [erectionPhase, dismantlingPhase, standingPhase];

    for (const [email, userId] of Object.entries(employees)) {
      for (const phase of phasesToAssign) {
        const existingAssignment = await prisma.crewAssignment.findUnique({
          where: {
            phaseId_userId_date: {
              phaseId: phase.id,
              userId: userId,
              date: today,
            },
          },
        });

        if (!existingAssignment) {
          await prisma.crewAssignment.create({
            data: {
              phaseId: phase.id,
              userId: userId,
              date: today,
              hours: 8,
            },
          });
          console.log(`Assigned employee ${email} to phase ${phase.type} on ${today.toISOString().slice(0, 10)}`);
        }
      }
    }
  }

  console.log('--- Non-Destructive Mobile Test Data Seed Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

