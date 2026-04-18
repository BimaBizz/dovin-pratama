export default function manifest() {
  return {
    name: "Dovin Pratama",
    short_name: "Dovin",
    description: "Dashboard operasional internal PT. Dovin Pratama.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#18181b",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/ico",
      },
    ],
  };
}