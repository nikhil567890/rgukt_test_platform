import { prisma } from '../src/server/db';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.payment.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.test.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  // Create Admins
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const adminUsers = [
    { name: 'RGUKT Admin', email: 'admin@rgukt.ac.in' },
    { name: 'Vinodh Sir', email: 'rvinodh45@gmail.com' },
    { name: 'Avinash Sir', email: 'avinashinapakurthi31@gmail.com' },
  ];

  for (const adm of adminUsers) {
    const admin = await prisma.user.create({
      data: {
        name: adm.name,
        email: adm.email,
        password: adminPasswordHash,
        role: 'ADMIN',
        isPremium: true,
        premiumSince: new Date(),
      },
    });
    console.log('Created Admin:', admin.email);
  }

  // Create Demo Premium Student
  const studentPasswordHash = await bcrypt.hash('student123', 10);
  const premiumStudent = await prisma.user.create({
    data: {
      name: 'Rahul Sharma',
      email: 'student@rgukt.ac.in',
      password: studentPasswordHash,
      role: 'STUDENT',
      isPremium: true,
      premiumSince: new Date(),
      currentStreak: 3,
      longestStreak: 5,
      lastAttemptDay: new Date().toISOString().split('T')[0],
    },
  });
  console.log('Created Premium Student:', premiumStudent.email);

  // Create Demo Free Student (To test Paywall)
  const freeStudentPasswordHash = await bcrypt.hash('demo1234', 10);
  const freeStudent = await prisma.user.create({
    data: {
      name: 'Ananya Verma',
      email: 'free@rgukt.ac.in',
      password: freeStudentPasswordHash,
      role: 'STUDENT',
      isPremium: false,
      currentStreak: 0,
      longestStreak: 0,
    },
  });
  console.log('Created Free Student:', freeStudent.email);

  // Create Sample Mathematics Test
  const test1 = await prisma.test.create({
    data: {
      title: 'RGUKT CET Mathematics Model Paper 2026',
      subject: 'Mathematics',
      durationMin: 15,
      totalMarks: 5,
      isPublished: true,
      questions: {
        create: [
          {
            questionText: 'If α and β are the roots of the quadratic equation x² - 5x + 6 = 0, what is α² + β²?',
            optionA: '13',
            optionB: '25',
            optionC: '19',
            optionD: '30',
            correctOption: 'A',
            marks: 1,
            explanation: 'For x² - 5x + 6 = 0, α + β = 5 and αβ = 6. Using the identity α² + β² = (α + β)² - 2αβ = 5² - 2(6) = 25 - 12 = 13.',
          },
          {
            questionText: 'What is the distance between the points (3, 4) and (7, 7) on the Cartesian plane?',
            optionA: '4 units',
            optionB: '5 units',
            optionC: '6 units',
            optionD: '7 units',
            correctOption: 'B',
            marks: 1,
            explanation: 'Distance = √[(7 - 3)² + (7 - 4)²] = √[16 + 9] = √25 = 5 units.',
          },
          {
            questionText: 'What is the sum of the first 20 natural numbers?',
            optionA: '200',
            optionB: '210',
            optionC: '220',
            optionD: '190',
            correctOption: 'B',
            marks: 1,
            explanation: 'Sum of first n natural numbers S_n = n(n + 1)/2. For n = 20, S_20 = 20(21)/2 = 210.',
          },
          {
            questionText: 'If tan A = 3/4 in a right-angled triangle, what is the value of cos A?',
            optionA: '3/5',
            optionB: '4/5',
            optionC: '5/4',
            optionD: '4/3',
            correctOption: 'B',
            marks: 1,
            explanation: 'Since tan A = opposite/adjacent = 3/4, hypotenuse = √(3² + 4²) = 5. Therefore, cos A = adjacent/hypotenuse = 4/5.',
          },
          {
            questionText: 'The value of sin 30° + cos 60° is equal to:',
            optionA: '0',
            optionB: '1/2',
            optionC: '1',
            optionD: '√3/2',
            correctOption: 'C',
            marks: 1,
            explanation: 'sin 30° = 1/2 and cos 60° = 1/2. Therefore, sin 30° + cos 60° = 1/2 + 1/2 = 1.',
          }
        ],
      },
    },
  });

  console.log('Created Sample Test with ID:', test1.id);

  // Seed Batches
  await prisma.batch.createMany({
    data: [
      { name: 'RGUKT 2026 - Nuzvid Batch A', code: 'RGUKT-NZD-A', stream: 'RGUKT CET Mathematics', description: 'Morning intensive Math practice batch for Nuzvid campus aspirants', studentCount: 145 },
      { name: 'RGUKT 2026 - RK Valley Batch B', code: 'RGUKT-RKV-B', stream: 'RGUKT CET Mathematics', description: 'Afternoon Math test series batch for RK Valley campus aspirants', studentCount: 120 },
      { name: 'RGUKT 2026 - Ongole & Srikakulam', code: 'RGUKT-ONG-SKL', stream: 'RGUKT CET Mathematics', description: 'Combined weekend Math mock exam batch', studentCount: 98 },
      { name: 'PUC-I Mathematics Foundation Stream', code: 'PUC1-FOUNDATION', stream: 'PUC-I Math', description: 'Bridge course in Mathematics for first year pre-university students', studentCount: 65 },
    ],
  });

  // Seed Announcements
  await prisma.announcement.createMany({
    data: [
      { title: 'RGUKT CET Mathematics Grand Mock Test #3 Released', content: 'The 3rd Grand Mock Test covering Algebra, Trigonometry, and Coordinate Geometry is live! Complete it before Sunday 8 PM.', priority: 'EXAM_ALERT', isPinned: true, targetBatch: 'ALL' },
      { title: 'Vinodh Sir Live Math Shortcut Seminar', content: 'Join live online seminar on Trigonometry and Quadratic Shortcuts this Friday at 6:00 PM.', priority: 'URGENT', isPinned: true, targetBatch: 'ALL' },
      { title: 'New Mathematics Question Bank Updated', content: 'Added 50 new chapter-wise MCQs for Quadratic Equations and Progressions in Question Bank.', priority: 'NORMAL', isPinned: false, targetBatch: 'RGUKT CET' },
    ],
  });

  // Seed Audit Logs
  await prisma.auditLog.createMany({
    data: [
      { action: 'TEST_PUBLISHED', details: 'Published RGUKT Entrance Grand Mock Test #1', adminName: 'Vinodh Sir' },
      { action: 'QUESTION_BANK_UPDATE', details: 'Added 15 Mathematics Trigonometry questions', adminName: 'Vinodh Sir' },
      { action: 'ANNOUNCEMENT_CREATED', details: 'Posted live seminar update for Grand Mock #3', adminName: 'Vinodh Sir' },
      { action: 'PREMIUM_GRANTED', details: 'Granted premium access to student@rgukt.ac.in', adminName: 'Vinodh Sir' },
    ],
  });

  // Create an attempt for Topper comparison baseline
  const topperScore = 5;
  await prisma.attempt.create({
    data: {
      userId: premiumStudent.id,
      testId: test1.id,
      answers: JSON.stringify({
        'q1': 'A',
        'q2': 'B',
        'q3': 'B',
        'q4': 'C',
        'q5': 'C'
      }),
      score: topperScore,
      totalMarks: 5,
      timeTakenSec: 240,
      startedAt: new Date(Date.now() - 300000),
      submittedAt: new Date(),
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
