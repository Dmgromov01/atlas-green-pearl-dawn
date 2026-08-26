import { createServerFn } from "@tanstack/react-start";
import { fetchJson } from "./cache";

export type ActivityIdea = {
  activity: string;
  type?: string;
  participants?: number;
  price?: number;
  accessibility?: number;
  link?: string;
};

const FALLBACK: ActivityIdea[] = [
  { activity: "Прогуляться 20 минут без телефона", type: "recreational", participants: 1, price: 0 },
  { activity: "Написать короткое письмо человеку, которого давно не видели", type: "social", participants: 1, price: 0 },
  { activity: "Приготовить что-то из того, что уже есть в холодильнике", type: "cooking", participants: 1, price: 0.2 },
  { activity: "Разобрать одну полку или ящик", type: "busywork", participants: 1, price: 0 },
  { activity: "Выучить 5 новых слов на другом языке", type: "education", participants: 1, price: 0 },
  { activity: "Сделать растяжку на 10 минут", type: "recreational", participants: 1, price: 0 },
  { activity: "Нарисовать то, что видите из окна", type: "recreational", participants: 1, price: 0 },
  { activity: "Позвонить другу и спросить, как у него день", type: "social", participants: 2, price: 0 },
];

function pickFallback(): ActivityIdea {
  return FALLBACK[Math.floor(Math.random() * FALLBACK.length)]!;
}

export const getActivity = createServerFn({ method: "GET" }).handler(async (): Promise<ActivityIdea> => {
  try {
    const raw = await fetchJson<ActivityIdea>("https://bored.api.lewagon.com/api/activity", 8000);
    if (!raw?.activity) return pickFallback();
    return {
      activity: raw.activity,
      type: raw.type,
      participants: raw.participants,
      price: raw.price,
      accessibility: raw.accessibility,
      link: raw.link,
    };
  } catch {
    return pickFallback();
  }
});
