-- migrations/add_fulltext_search_indices.sql

-- ✅ Full-text search for profile names
CREATE INDEX CONCURRENTLY IF NOT EXISTS "profile_translations_fulltext_name_idx" 
ON "profile_translations" USING gin(
  to_tsvector('english', "firstName" || ' ' || "lastName")
);

-- ✅ Full-text search for profile bio
CREATE INDEX CONCURRENTLY IF NOT EXISTS "profile_translations_fulltext_bio_idx" 
ON "profile_translations" USING gin(to_tsvector('english', coalesce("bio", '')));

-- ✅ Full-text search for post content (if needed)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "post_translations_fulltext_content_idx" 
ON "post_translations" USING gin(
  to_tsvector('english', "title" || ' ' || coalesce("content", '') || ' ' || coalesce("excerpt", ''))
);

-- ✅ Full-text search for comments
CREATE INDEX CONCURRENTLY IF NOT EXISTS "comments_fulltext_content_idx" 
ON "comments" USING gin(to_tsvector('english', "content"));