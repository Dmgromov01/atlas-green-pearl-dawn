import {
  Brain,
  CalendarDays,
  Coins,
  House,
  Inbox,
  KeyRound,
  Languages,
  MessageCircle,
  Newspaper,
  Settings,
  Shield,
  SquareCheckBig,
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
    id: "chat",
    title: "Агент",
    shortTitle: "Агент",
    description: "Чат с OpenClaw",
    icon: MessageCircle,
    path: "/chat",
    showInTabBar: true,
    showOnHome: false,
    order: 1,
  },
  {
    id: "digest",
    title: "Дайджест",
    shortTitle: "Дайджест",
    description: "Новости из ваших источников",
    icon: Newspaper,
    path: "/digest",
    showInTabBar: false,
    showOnHome: true,
    order: 2,
  },
  {
    id: "inbox",
    title: "Inbox",
    shortTitle: "Inbox",
    description: "Заметки и мысли",
    icon: Inbox,
    path: "/",
    showInTabBar: false,
    showOnHome: true,
    order: 3,
  },
  {
    id: "fun",
    title: "Викторины и идеи",
    shortTitle: "Викторины",
    description: "Вопросы и занятия",
    icon: Brain,
    path: "/fun",
    showInTabBar: false,
    showOnHome: true,
    order: 4,
  },
  {
    id: "translate",
    title: "Переводчик",
    shortTitle: "Перевод",
    description: "Перевод и личный словарь",
    icon: Languages,
    path: "/translate",
    showInTabBar: false,
    showOnHome: true,
    order: 5,
  },
  {
    id: "settings",
    title: "Настройки",
    shortTitle: "Ещё",
    description: "Профиль, город, модули",
    icon: Settings,
    path: "/settings",
    showInTabBar: false,
    showOnHome: false,
    order: 6,
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
    order: 7,
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
    order: 8,
  },
  {
    id: "rates",
    title: "Валюты",
    shortTitle: "Курсы",
    description: "Курсы ЦБ и конвертер",
    icon: Coins,
    path: "/rates",
    showInTabBar: false,
    showOnHome: false,
    order: 9,
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
    order: 10,
  },
  {
    id: "admin",
    title: "Админка",
    shortTitle: "Админ",
    description: "Пользователи, квоты, аудит",
    icon: Shield,
    path: "/admin",
    showInTabBar: false,
    showOnHome: false,
    order: 11,
  },
];

export function getModule(id: HubModuleId) {
  return HUB_MODULES.find((m) => m.id === id);
}

export function tabModules(enabled: HubModuleId[] | "all" = "all") {
  return HUB_MODULES.filter((m) => {
    if (!m.showInTabBar) return false;
    if (m.id === "home" || m.id === "chat") return true;
    return enabled === "all" || enabled.includes(m.id);
  }).sort((a, b) => a.order - b.order);
}

export function homeModules(enabled: HubModuleId[] | "all" = "all") {
  return HUB_MODULES.filter(
    (m) => m.showOnHome && (enabled === "all" || enabled.includes(m.id)),
  ).sort((a, b) => a.order - b.order);
}
