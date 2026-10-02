import { filterMedia, isLibraryWorthy, mediaName, pathFromUrl, type MediaItem } from "../../src/utils/mediaLibrary";
import { MIN_UPLOAD_CHARS } from "../../src/utils/imageStore";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

const base = "https://abc.supabase.co/storage/v1/object/public/book-images/";
ok(pathFromUrl(base + "1111-uid/9f8e.png") === "1111-uid/9f8e.png" && pathFromUrl(base + "1111-uid/9f8e.svg?t=1") === "1111-uid/9f8e.svg", "a Storage link gives back the file's path (query string ignored)");
ok(pathFromUrl("https://elsewhere.com/pic.png") === null && pathFromUrl(base + "no-folder.png") === null && pathFromUrl(base + "a/b/c.png") === null, "other links, and paths that aren't <user>/<file>, are refused");
ok(isLibraryWorthy("data:image/png;base64," + "A".repeat(MIN_UPLOAD_CHARS)) && !isLibraryWorthy("data:image/svg+xml;utf8,<svg/>") && !isLibraryWorthy(base + "u/x.png") && !isLibraryWorthy("data:text/plain," + "A".repeat(MIN_UPLOAD_CHARS)), "only real embedded pictures of some size go in — not built-in icons, links or other data");
ok(mediaName("my_farm-cow.PNG", "upload") === "my farm cow" && mediaName(undefined, "ai") === "AI picture" && mediaName("  ", "upload") === "Picture" && mediaName("α".repeat(200), "ai").length === 80, "names are tidied from file names, with a fallback and a length cap");
const item = (name: string, source: "upload" | "ai"): MediaItem => ({ id: name, path: "u/" + name, url: base + "u/" + name, name, mime: "image/png", width: 1, height: 1, source, createdAt: "" });
const all = [item("Αγελάδα", "ai"), item("my cow photo", "upload"), item("Γάτα", "ai")];
ok(filterMedia(all, "all", "").length === 3 && filterMedia(all, "ai", "").length === 2 && filterMedia(all, "upload", "")[0].name === "my cow photo", "filter by where the picture came from");
ok(filterMedia(all, "all", " ΑΓΕΛ ").map((m) => m.name).join() === "Αγελάδα" && filterMedia(all, "upload", "γάτα").length === 0 && filterMedia(all, "all", "cow")[0].source === "upload", "search by name ignores case and surrounding spaces, and combines with the filter");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
