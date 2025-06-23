-- migrations/add_partial_indices.sql

-- ✅ Active users only index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_active_only_idx" 
ON "users" ("createdAt" DESC, "email") 
WHERE "isActive" = true AND "deletedAt" IS NULL;

-- ✅ Published posts only index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "posts_published_only_idx" 
ON "posts" ("publishedAt" DESC, "views" DESC) 
WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

-- ✅ Approved comments only index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "comments_approved_only_idx" 
ON "comments" ("createdAt" DESC, "postId") 
WHERE "isApproved" = true AND "deletedAt" IS NULL;

-- ✅ Active sessions only index
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_active_only_idx" 
ON "sessions" ("userId", "expiresAt" DESC) 
WHERE "isActive" = true AND "expiresAt" > NOW();