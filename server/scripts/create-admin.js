const { PrismaClient } = require('@prisma/client');
require('dotenv').config({
  path: require('path').join(__dirname, '..', '..', '.env'),
});
const readline = require('readline');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

const questionPassword = (query) => {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(query);

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';

    const onData = (char) => {
      char = char.toString('utf8');

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f':
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.clearLine(0);
            stdout.cursorTo(0);
            stdout.write(query + '*'.repeat(password.length));
          }
          break;
        default:
          password += char;
          stdout.write('*');
          break;
      }
    };

    stdin.on('data', onData);
  });
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.trim());
};

const createAdmin = async () => {
  try {
    await prisma.$connect();
    console.log('✓ Connected to PostgreSQL\n');
    console.log('Creating Admin User');
    console.log('-------------------\n');

    // --- Full Name ---
    let fullName = '';
    while (!fullName || fullName.length < 2) {
      fullName = await question('Full Name: ');
      if (!fullName) {
        console.log('⚠ Full Name cannot be empty!');
      } else if (fullName.length < 2) {
        console.log('⚠ Full Name must be at least 2 characters long!');
        fullName = '';
      }
    }

    // --- Email ---
    let email = '';
    while (!email || !isValidEmail(email)) {
      email = await question('Email: ');
      if (!email) {
        console.log('⚠ Email cannot be empty!');
      } else if (!isValidEmail(email)) {
        console.log('⚠ Please enter a valid email address!');
        email = '';
      } else {
        const existingUser = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (existingUser) {
          console.log('⚠ A user with this email already exists!');
          email = '';
        }
      }
    }

    // --- Phone ---
    let phone = '';
    while (!phone || !isValidPhone(phone)) {
      phone = await question('Phone (e.g. +1234567890): ');
      if (!phone) {
        console.log('⚠ Phone cannot be empty!');
      } else if (!isValidPhone(phone)) {
        console.log(
          '⚠ Please enter a valid phone number (E.164 format, e.g. +1234567890)!'
        );
        phone = '';
      }
    }

    // --- Password ---
    let password = '';
    let confirmPassword = '';
    while (!password || password !== confirmPassword || password.length < 8) {
      password = await questionPassword('Password: ');
      if (!password) {
        console.log('⚠ Password cannot be empty!');
        continue;
      }
      if (password.length < 8) {
        console.log('⚠ Password must be at least 8 characters long!');
        password = '';
        continue;
      }
      confirmPassword = await questionPassword('Confirm Password: ');
      if (password !== confirmPassword) {
        console.log('⚠ Passwords do not match!');
        password = '';
        confirmPassword = '';
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // --- Create User + UserPreference in a transaction ---
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const user = await tx.user.create({
        data: {
          fullName: fullName.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          password: hashedPassword,
          role: 'ADMIN',
          status: 'ACTIVE',
          isProfileSetup: true,
          isLegalTermAccepted: true,
          emailVerifiedAt: now,
          phoneVerifiedAt: now,
          profileCompletedAt: now,
        },
      });

      const preference = await tx.userPreference.create({
        data: {
          userId: user.id,
        },
      });

      return { user, preference };
    });

    console.log('\n✓ Admin user created successfully!');
    console.log(`Email:     ${result.user.email}`);
    console.log(`Full Name: ${result.user.fullName}`);
    console.log(`Phone:     ${result.user.phone}`);
    console.log(`Role:      ${result.user.role}`);
    console.log(`Status:    ${result.user.status}`);
    console.log(`ID:        ${result.user.id}`);

    rl.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error creating admin:', error.message);
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }
};

createAdmin();
