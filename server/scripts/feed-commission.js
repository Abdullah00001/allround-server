const { PrismaClient } = require('@prisma/client');
require('dotenv').config({
  path: require('path').join(__dirname, '..', '..', '.env'),
});

const prisma = new PrismaClient();

const commissionRecords = [
  {
    serviceType: 'EVENT',
    chargePercentage: 10,
  },
  {
    serviceType: 'CLUB',
    chargePercentage: 10,
  },
];

const globalServiceCharge = {
  id: 'GLOBAL',
  amount: '5.50',
};

const feedCommissionConfiguration = async () => {
  try {
    await prisma.$connect();
    console.log('Starting commission configuration initialization...\n');

    // Run within a transaction for safety
    await prisma.$transaction(async (tx) => {
      for (const record of commissionRecords) {
        // Since serviceType is not marked as @unique in the schema,
        // we cannot use tx.applicationCharge.upsert(). We must use an existence check.
        const existing = await tx.applicationCharge.findFirst({
          where: {
            serviceType: record.serviceType,
          },
        });

        if (existing) {
          console.log(`✓ Commission for ${record.serviceType} already exists — skipped`);
        } else {
          await tx.applicationCharge.create({
            data: {
              serviceType: record.serviceType,
              chargePercentage: record.chargePercentage,
            },
          });
          console.log(`✓ Commission for ${record.serviceType} created with ${record.chargePercentage}%`);
        }
      }

      await tx.serviceCharge.upsert({
        where: { id: globalServiceCharge.id },
        create: globalServiceCharge,
        update: {},
      });
      console.log('✓ Global Service Charge initialized or already exists — preserved');
    });

    console.log('\nCommission configuration initialization completed successfully.');
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error during commission configuration initialization:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
};

feedCommissionConfiguration();
