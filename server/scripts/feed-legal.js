const { PrismaClient } = require('@prisma/client');
require('dotenv').config({
  path: require('path').join(__dirname, '..', '..', '.env'),
});

const prisma = new PrismaClient();

const legalRecords = [
  {
    type: 'TERMS_AND_CONDITION',
    label: 'Terms & Conditions',
    content: `Welcome to Allround.

These Terms & Conditions are currently provided as initial placeholder content.
The final terms will be maintained by the Allround administration team.`,
  },
  {
    type: 'PRIVACY_AND_POLICY',
    label: 'Privacy Policy',
    content: `Allround respects your privacy.

This Privacy Policy currently contains initial placeholder content.
The final privacy policy will be maintained by the Allround administration team.`,
  },
  {
    type: 'ABOUT_US',
    label: 'About Us',
    content: `Welcome to Allround.

This page contains initial placeholder content.
The Allround administration team can update this information from the Admin Panel.`,
  },
];

const feedLegalContent = async () => {
  try {
    await prisma.$connect();
    console.log('Starting legal content initialization...\n');

    // Run within a transaction for safety
    await prisma.$transaction(async (tx) => {
      for (const record of legalRecords) {
        // Since legalContentType is not marked as @unique in the schema,
        // we cannot use tx.legalContent.upsert(). We must use an existence check.
        const existing = await tx.legalContent.findFirst({
          where: {
            legalContentType: record.type,
          },
        });

        if (existing) {
          console.log(`✓ ${record.label} already exists — skipped`);
        } else {
          await tx.legalContent.create({
            data: {
              legalContentType: record.type,
              content: record.content,
            },
          });
          console.log(`✓ ${record.label} created`);
        }
      }
    });

    console.log('\nLegal content initialization completed successfully.');
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error during legal content initialization:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
};

feedLegalContent();
