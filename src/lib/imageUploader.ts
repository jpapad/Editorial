"use client";

// The Supabase Storage side of imageStore.ts. Switches itself off for the
// session at the first sign that it can't work — signed out, the bucket
// not created yet (sql/07_image_storage.sql), or a link that doesn't
// actually open — so a book is never saved pointing at pictures nobody
// can load.

import { supabase } from "@/lib/supabase/client";
import { decodeDataUrl, EXTENSIONS, type Uploader } from "@/utils/imageStore";

export const IMAGE_BUCKET = "book-images";

let off = false;
let verified = false;

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const uploadBookImage: Uploader = async (dataUrl) => {
  if (off) return null;
  const decoded = decodeDataUrl(dataUrl);
  const ext = decoded && EXTENSIONS[decoded.mime];
  if (!decoded || !ext) return null;
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return null;

  // Named by content: the same picture used on ten pages (or in ten books) is one file.
  const path = `${userId}/${await sha256(decoded.bytes)}.${ext}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, new Blob([decoded.bytes as BlobPart], { type: decoded.mime }), { contentType: decoded.mime, cacheControl: "31536000", upsert: false });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    // No bucket, no permission, too big…: stop trying; everything stays embedded.
    off = true;
    return null;
  }
  const url = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  if (!verified) {
    // Trust the links only once one has been seen to open (a bucket that isn't public would upload fine and then show nothing).
    try {
      const probe = await fetch(url, { method: "GET", cache: "no-store" });
      if (!probe.ok || !(probe.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(String(probe.status));
      verified = true;
    } catch {
      off = true;
      return null;
    }
  }
  return url;
};
