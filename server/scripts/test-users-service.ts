import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SupportedLanguage } from '../src/i18n/constants/languages';
import { UsersService } from '../src/users/users.service';

async function testUsersService() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  try {
    console.log('Testing Users Service...\n');

    // Test 1: Create simple user
    console.log('Test 1: Createing simple user...');
    const simpleUser = await usersService.create(
      {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        preferredLanguage: SupportedLanguage.ENGLISH,
      },
      SupportedLanguage.ENGLISH,
    );

    console.log('Simple user created:', {
      id: simpleUser.id,
      email: simpleUser.email,
      preferredLanguage: simpleUser.preferredLanguage,
    });

    // Test 2: Create user with profile
    console.log('\n📝 Test 2: Creating user with multilingual profile...');
    const userWithProfile = await usersService.createWithProfile(
      {
        email: 'multilingual@example.com',
        password: 'SecurePassword123!',
        preferredLanguage: SupportedLanguage.INDONESIAN,
        avatar: 'https://example.com/avatar.jpg',
        phone: '+6281234567890',
        address: 'Jakarta, Indonesia',
        birthday: '1990-01-01',
        profileTranslations: [
          {
            language: SupportedLanguage.INDONESIAN,
            firstName: 'Budi',
            lastName: 'Santoso',
            bio: 'Pengembang perangkat lunak dari Jakarta',
          },
          {
            language: SupportedLanguage.ENGLISH,
            firstName: 'Budi',
            lastName: 'Santoso',
            bio: 'Software developer from Jakarta',
          },
          {
            language: SupportedLanguage.CHINESE,
            firstName: '布迪',
            lastName: '桑托索',
            bio: '来自雅加达的软件开发人员',
          },
        ],
      },
      SupportedLanguage.INDONESIAN,
    );

    console.log('✅ Multilingual user created:', {
      id: userWithProfile.id,
      email: userWithProfile.email,
      profileId: userWithProfile.profile?.id,
      currentTranslation: userWithProfile.translation,
    });

    // Test 3: Find user by ID in different languages
    console.log('\n Test 3: Testing multilingual retrieval...');
    const userInIndonesian = await usersService.findOne(
      userWithProfile.id,
      SupportedLanguage.INDONESIAN,
    );
    console.log('User in Indonesian:', userInIndonesian.translation);

    const userInEnglish = await usersService.findOne(
      userWithProfile.id,
      SupportedLanguage.ENGLISH,
    );
    console.log('User in English:', userInEnglish.translation);

    const userInChinese = await usersService.findOne(
      userWithProfile.id,
      SupportedLanguage.CHINESE,
    );
    console.log('User in Chinese:', userInChinese.translation);

    // Test 4: Update profile translation
    console.log('\n Test 4: Testing profile translation update...');
    const updatedUser = await usersService.updateProfileTranslation(
      userWithProfile.id,
      SupportedLanguage.ENGLISH,
      {
        language: SupportedLanguage.ENGLISH,
        firstName: 'Updated Budi',
        lastName: 'Updated Santoso',
        bio: 'Updated: Senior software developer from Jakarta',
      },
      SupportedLanguage.ENGLISH,
    );

    console.log('Profile translation updated:', updatedUser.translation);

    // Test 5: List users with pagination
    console.log('\n Test 5: Testing user listing with pagination...');
    const userList = await usersService.findAll(
      1,
      5,
      SupportedLanguage.ENGLISH,
    );
    console.log('User list retrieved:', {
      totalUsers: userList.meta.total,
      usersInPage: userList.data.length,
      pagination: userList.meta,
    });

    // Test 6: Get user statistics
    console.log('\n Test 6: Testing user statistics...');
    const stats = await usersService.getUserStats(SupportedLanguage.ENGLISH);
    console.log('User statistics:', stats);

    // Test 7: Error handling - duplicate email
    console.log('\n Test 7: testing error handling');
    try {
      await usersService.create(
        {
          email: 'test@example.com',
          password: 'AnotherPassword123!',
        },
        SupportedLanguage.ENGLISH,
      );
      console.log('Should have thrown error for duplicate email');
    } catch (error) {
      console.log('Duplicate email error handles correctly:', error.message);
    }

    // Test 8: Error handling - user not found
    try {
      await usersService.findOne('non-existent-id', SupportedLanguage.ENGLISH);
      console.log('Should have thrown error for non existent user');
    } catch (error) {
      console.log('Should have thrown error handled correctly:', error.message);
    }

    console.log('\n All users Service test completed successfully');
  } catch (error) {
    console.log('Users Service test failed:', error);
  } finally {
    await app.close();
  }
}

testUsersService();
