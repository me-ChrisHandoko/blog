import { User, Profile, ProfileTranslation, Language } from '@prisma/client';
import {
  SafeUser,
  UserWithProfile,
  CleanTranslation,
} from '../../users/types/user.types';

export class UserMapper {
  /**
   * Convert Prisma User to SafeUser (remove password)
   */
  static toSafeUser(prismaUser: User): SafeUser {
    const { password, ...safeUser } = prismaUser;
    return safeUser as SafeUser;
  }

  /**
   * Convert ProfileTranslation to CleanTranslation
   */
  static toCleanTranslation(translation: ProfileTranslation): CleanTranslation {
    return {
      language: translation.language,
      firstName: translation.firstName,
      lastName: translation.lastName,
      bio: translation.bio || undefined,
    };
  }

  /**
   * Convert Profile with translations to clean format
   */
  static toCleanProfile(
    profile: Profile & { translations: ProfileTranslation[] },
  ) {
    return {
      id: profile.id,
      avatar: profile.avatar,
      phone: profile.phone,
      address: profile.address,
      birthday: profile.birthday,
      userId: profile.userId,
      translations: profile.translations.map(this.toCleanTranslation),
    };
  }

  /**
   * Convert User with Profile to UserWithProfile
   */
  static toUserWithProfile(
    user: User,
    profile?: Profile & { translations: ProfileTranslation[] },
  ): UserWithProfile {
    const safeUser = this.toSafeUser(user);

    if (profile) {
      return {
        ...safeUser,
        profile: this.toCleanProfile(profile),
      };
    }

    return safeUser;
  }
}
