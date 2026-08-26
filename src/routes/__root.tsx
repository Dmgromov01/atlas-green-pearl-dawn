import { APP_NAME } from "@/lib/brand";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { TelegramBoot } from "@/components/telegram-boot";
import { PersistBoot } from "@/components/persist-boot";
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
      { name: "description", content: "Личный хаб: погода, курсы, задачи, дайджест и переводчик." },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/logo-mark.png" },
      { rel: "icon", type: "image/svg+xml", href: "/logo.svg" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/logo-mark.png" },
    ],
    scripts: [{ src: "https://telegram.org/js/telegram-web-app.js" }],
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
          <QuietBoundary>
            <TelegramBoot />
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
