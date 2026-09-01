import { useNavigate } from "@tanstack/react-router";
import { Languages } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { FinanceTicker } from "@/components/home/finance-ticker";
import { ReadonlyTasksCard } from "@/components/home/readonly-tasks-card";
import { TodayScheduleCard } from "@/components/home/today-schedule-card";
import { WeatherTrend } from "@/components/home/weather-trend";
import { haptic } from "@/lib/haptic";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";

export function HomeView() {
  const navigate = useNavigate();
  const hubName = useHub((s) => s.user?.displayName);
  const localName = useSettings((s) => s.displayName);
  const name = hubName || localName;
  const greet = name && name !== "Гость" ? `Привет, ${name}` : "Привет";

  return (
    <AppShell className="reference-shell">
      <Header greet={greet} />
      <main className="reference-home">
        <WeatherTrend />
        <FinanceTicker />
        <TodayScheduleCard />
        <ReadonlyTasksCard />
        <button type="button" className="translator-link" onClick={() => { haptic("light"); void navigate({ to: "/translate" }); }}>
          <Languages aria-hidden="true" /><span>Переводчик</span><small>EN · ES · RU</small>
        </button>
      </main>
    </AppShell>
  );
}
