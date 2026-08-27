import { APP_NAME, APP_SHORT } from "@/lib/brand";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { HubBoot } from "@/components/hub-boot";
import { PersistBoot } from "@/components/persist-boot";
import { SwBoot } from "@/components/sw-boot";
import { QuietBoundary } from "@/components/quiet-boundary";
import { Gate } from "@/components/gate";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#F5F7FB" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: APP_SHORT },
      { name: "description", content: "Личный хаб: погода, курсы, задачи, дайджест и переводчик." },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/logo-mark.png" },
      { rel: "icon", type: "image/svg+xml", href: "/logo.svg" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/__grok/icon-180.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
    ],
    scripts: [
      {
        children: `try{if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(x){x.unregister()});});}if(window.caches){caches.keys().then(function(k){k.forEach(function(n){if(String(n).indexOf('ai-hub')===0)caches.delete(n);});});}}catch(e){}`,
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <QuietBoundary>
          <PreviewHostBridge />
        </QuietBoundary>
        <AuthProvider>
          <PersistBoot />
          <SwBoot />
          <QuietBoundary>
            <HubBoot />
          </QuietBoundary>
          <Gate>
            <Outlet />
          </Gate>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
