-- migrations/add_covering_indices.sql

-- ✅ User lookup with profile data
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_with_profile_data_idx" 
ON "users" ("id", "email", "isActive", "preferredLanguage", "createdAt") 
WHERE "deletedAt" IS NULL;

-- ✅ Post listing with author info
CREATE INDEX CONCURRENTLY IF NOT EXISTS "posts_with_author_info_idx" 
ON "posts" ("status", "publishedAt", "authorId", "categoryId", "views", "likes") 
WHERE "deletedAt" IS NULL;