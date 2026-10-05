-- Pictures out of the book rows: a public Storage bucket the editor uploads
-- a book's pictures to, so a book's saved data holds short links instead of
-- megabytes of embedded images (faster saves, smaller rows).
--
-- Run once in Supabase > SQL Editor. Safe to re-run.
-- Until it runs, pictures stay embedded in the book (as before).
--
-- The bucket is public-read on purpose: pages are drawn on a canvas, which
-- needs to read the picture without credentials (and share links for
-- children are anonymous). File names are a hash of the picture inside the
-- owner's own folder, so they can't be guessed or listed by others.

do $$
begin
  -- Supabase only: plain Postgres (the test database) has no storage schema.
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not found — skipping the image bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('book-images', 'book-images', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  -- Upload and delete only inside a folder named after your own user id.
  execute 'drop policy if exists "Users upload their own book images" on storage.objects';
  execute $p$create policy "Users upload their own book images" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'book-images' and (storage.foldername(name))[1] = auth.uid()::text)$p$;

  execute 'drop policy if exists "Users delete their own book images" on storage.objects';
  execute $p$create policy "Users delete their own book images" on storage.objects
    for delete to authenticated
    using (bucket_id = 'book-images' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
end $$;
