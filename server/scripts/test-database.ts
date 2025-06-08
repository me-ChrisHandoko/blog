import { PrismaClient } from '@prisma/client';

async function testDatabase() {
  const prisma = new PrismaClient();

  try {
    console.log('Testing database connection...');

    // Test basic connection
    await prisma.$connect();
    console.log('Database connected succesfully');

    // Test query execution
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Query execution succesful:', result);

    // Test user table structure
    const userCount = await prisma.user.count();
    console.log(`User table accessible. Current count: ${userCount}`);

    // Test profile table structure
    const profileCount = await prisma.profile.count();
    console.log(`Profile table accessible. Current count: ${profileCount}`);

    // Test profile translation table
    const translationCount = await prisma.profileTranslation.count();
    console.log(
      `ProfileTranslation table accessible. Current count: ${translationCount}`,
    );

    // Test categories
    const categoryCount = await prisma.category.count();
    console.log(`Category table accessible. Current count: ${categoryCount}`);

    // Test posts
    const postCount = await prisma.post.count();
    console.log(`Post table accessible. Current count: ${postCount}`);

    console.log('\n All database tests passed!');
  } catch (error) {
    console.log(`❌ Database test failed:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
