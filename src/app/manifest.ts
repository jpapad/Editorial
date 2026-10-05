import type { MetadataRoute } from "next";

// Installable app (Add to Home Screen): the studio for grown-ups, with a
// shortcut straight to the children's coloring at /kids — on a class
// tablet, install from /kids and it opens there.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pagewright — coloring books",
    short_name: "Pagewright",
    description: "Design, color and publish coloring books.",
    start_url: "/studio",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f5f8",
    theme_color: "#3357d4",
    lang: "el",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Ζωγραφική για παιδιά", short_name: "Παιδιά", url: "/kids", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Τα βιβλία μου", url: "/studio" },
    ],
  };
}
