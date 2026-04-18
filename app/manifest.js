export default function manifest() {
  return {
    name: "Dovin Pratama",
    short_name: "Dovin",
    description: "Dashboard operasional internal PT. Dovin Pratama.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#18181b",
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [
      {
        src: "/pwa-screenshot-desktop.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "Dashboard desktop",
      },
      {
        src: "/pwa-screenshot-mobile.png",
        sizes: "540x960",
        type: "image/png",
        label: "Dashboard mobile",
      },
    ],
  };
}