import { useNavigate } from "@tanstack/react-router";
import { Languages } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Card } from "@/components/ui/card";
import { ServiceRow } from "@/components/shell/service-row";
import { WeatherChip } from "@/components/home/weather-chip";
import { SummaryStrip } from "@/components/home/summary-strip";
import { TodayCard } from "@/components/home/today-card";
import { TasksCard } from "@/components/home/tasks-card";
import { CalendarCard } from "@/components/home/calendar-card";
import { InboxCard } from "@/components/home/inbox-card";
import { RemindersCard } from "@/components/home/reminders-card";

import { UsefulTodayCard } from "@/components/home/useful-today-card";
import { useSettings } from "@/lib/stores/settings";
import { useHub } from "@/lib/stores/hub";
import { haptic } from "@/lib/haptic";

export function HomeView() {
  const navigate = useNavigate();
  const hubName = useHub((s) => s.user?.displayName);
  const localName = useSettings((s) => s.displayName);
  const name = hubName || localName;
  const enabled = useSettings((s) => s.enabledModules);
  const show = (id: "tasks" | "calendar" | "translate" | "inbox") =>
    enabled === "all" || enabled.includes(id);
  const greet = name && name !== "Гость" ? `Привет, ${name}` : "Привет";

  return (
    <AppShell>
      <Header greet={greet} right={<WeatherChip />} />
      <div className="hub-home">
        <SummaryStrip />
        <div className="hub-grid px-4 sm:px-6">
          <TodayCard />
          <UsefulTodayCard />
          <RemindersCard />
          {show("inbox") ? <InboxCard /> : null}
          {show("tasks") ? <TasksCard /> : null}
          {show("calendar") ? <CalendarCard /> : null}
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
