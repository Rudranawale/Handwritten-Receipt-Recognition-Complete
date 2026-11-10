// // @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// // or the app will break with duplicate plugins:
// //   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
// //     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
// //     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// // You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
// import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// export default defineConfig({
//   tanstackStart: {
//     // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
//     // nitro/vite builds from this
//     server: { entry: "server" },
//   },
// });

// import { defineConfig } from "vite";
// // baaki existing imports

// export default defineConfig({
//   // baaki existing configuration

//   server: {
//     host: "0.0.0.0",
//     port: 8080,
//     allowedHosts: ["tapes-lived-straight-configuring.trycloudflare.com"],
//   },
// });



import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },

  nitro: {
    preset: "render-com",
  },

  vite: {
    server: {
      allowedHosts: ["prostores-cool-angela-crafts.trycloudflare.com"],
    },
  },
});


// import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// export default defineConfig({
//   tanstackStart: {
//     server: { entry: "server" },
//   },

//   vite: {
//     server: {
//       // allowedHosts: ["tapes-lived-straight-configuring.trycloudflare.com"],
//       allowedHosts: [ "prostores-cool-angela-crafts.trycloudflare.com"],
//     },
//   },
// });
