import { useNavigate } from "@tanstack/react-router";
import { Brain, Languages } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Card } from "@/components/ui/card";
import { ServiceRow } from "@/components/shell/service-row";
import { WeatherCard } from "@/components/weather/weather-card";
import { SummaryStrip } from "@/components/home/summary-strip";
import { TodayCard } from "@/components/home/today-card";
import { TasksCard } from "@/components/home/tasks-card";
import { CalendarCard } from "@/components/home/calendar-card";
import { InboxCard } from "@/components/home/inbox-card";
import { PasswordCard } from "@/components/home/password-card";
import { HomeScreenCard } from "@/components/settings/home-screen-card";
import { useSettings } from "@/lib/stores/settings";
import { haptic } from "@/lib/haptic";

export function HomeView() {
  const navigate = useNavigate();
  const name = useSettings((s) => s.displayName);
  const enabled = useSettings((s) => s.enabledModules);
  const show = (id: "tasks" | "calendar" | "passwords" | "fun" | "translate" | "inbox") =>
    enabled === "all" || enabled.includes(id);
  const greet = name && name !== "Гость" ? `Привет, ${name}` : "Привет";

  return (
    <AppShell>
      <Header greet={greet} />
      <div className="hub-home">
        <SummaryStrip />
        <WeatherCard />
        <div className="hub-grid px-4 sm:px-6">
          <HomeScreenCard home />
          <TodayCard />
          {show("inbox") ? <InboxCard /> : null}
          {show("tasks") ? <TasksCard /> : null}
          {show("calendar") ? <CalendarCard /> : null}
          {show("passwords") ? <PasswordCard /> : null}
          {show("fun") ? (
            <Card>
              <ServiceRow
                icon={<Brain className="size-4" />}
                title="Викторины и идеи"
                status="Вопросы и чем заняться"
                onClick={() => {
                  haptic("medium");
                  navigate({ to: "/fun" });
                }}
              />
            </Card>
          ) : null}
          {show("translate") ? (
            <Card>
              <ServiceRow
                icon={<Languages className="size-4" />}
                title="Переводчик и словарь"
                status="EN · ES · RU"
                onClick={() => {
                  haptic("medium");
                  navigate({ to: "/translate" });
                }}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
