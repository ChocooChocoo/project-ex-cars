-- Free-plan storage is 1 GB. Every bucket now rejects files over 2 MB; the browser shrinks photos to fit
-- before upload (src/lib/uploads/compress-image.ts). Existing files are not touched.
UPDATE storage.buckets SET file_size_limit = 2097152;
