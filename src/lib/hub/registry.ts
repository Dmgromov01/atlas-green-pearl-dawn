import {
  Brain,
  CalendarDays,
  Coins,
  House,
  KeyRound,
  Newspaper,
  Settings,
  SquareCheckBig,
  Languages,
} from "lucide-react";
import type { HubModule, HubModuleId } from "./types";

export const HUB_MODULES: HubModule[] = [
  {
    id: "home",
    title: "Главная",
    shortTitle: "Главная",
    description: "Сводка дня",
    icon: House,
    path: "/",
    showInTabBar: true,
    showOnHome: false,
    order: 0,
  },
  {
    id: "digest",
    title: "Дайджест",
    shortTitle: "Дайджест",
    description: "Новости из ваших источников",
    icon: Newspaper,
    path: "/digest",
    showInTabBar: true,
    showOnHome: true,
    order: 1,
  },
  {
    id: "fun",
    title: "Викторины и идеи",
    shortTitle: "Викторины",
    description: "Вопросы и занятия",
    icon: Brain,
    path: "/fun",
    showInTabBar: true,
    showOnHome: true,
    order: 2,
  },
  {
    id: "translate",
    title: "Переводчик",
    shortTitle: "Перевод",
    description: "Перевод и личный словарь",
    icon: Languages,
    path: "/translate",
    showInTabBar: true,
    showOnHome: true,
    order: 3,
  },
  {
    id: "settings",
    title: "Настройки",
    shortTitle: "Ещё",
    description: "Профиль, город, модули",
    icon: Settings,
    path: "/settings",
    showInTabBar: true,
    showOnHome: false,
    order: 4,
  },
  {
    id: "tasks",
    title: "Задачи",
    shortTitle: "Задачи",
    description: "Список дел и архив",
    icon: SquareCheckBig,
    path: "/archive",
    showInTabBar: false,
    showOnHome: true,
    order: 5,
  },
  {
    id: "calendar",
    title: "Календарь",
    shortTitle: "Календарь",
    description: "События на 7 дней",
    icon: CalendarDays,
    path: "/calendar",
    showInTabBar: false,
    showOnHome: true,
    order: 6,
  },
  {
    id: "rates",
    title: "Валюты",
    shortTitle: "Курсы",
    description: "Курсы ЦБ и конвертер",
    icon: Coins,
    path: "/",
    showInTabBar: false,
    showOnHome: true,
    order: 7,
  },
  {
    id: "passwords",
    title: "Пароли",
    shortTitle: "Пароли",
    description: "Генератор надёжных паролей",
    icon: KeyRound,
    path: "/",
    showInTabBar: false,
    showOnHome: true,
    order: 8,
  },
];

export function getModule(id: HubModuleId) {
  return HUB_MODULES.find((m) => m.id === id);
}

export function tabModules(enabled: HubModuleId[] | "all" = "all") {
  return HUB_MODULES.filter((m) => {
    if (!m.showInTabBar) return false;
    if (m.id === "home" || m.id === "settings") return true;
    return enabled === "all" || enabled.includes(m.id);
  }).sort((a, b) => a.order - b.order);
}

export function homeModules(enabled: HubModuleId[] | "all" = "all") {
  return HUB_MODULES.filter(
    (m) => m.showOnHome && (enabled === "all" || enabled.includes(m.id)),
  ).sort((a, b) => a.order - b.order);
}
