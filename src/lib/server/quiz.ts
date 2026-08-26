import { createServerFn } from "@tanstack/react-start";
import { fetchJson } from "./cache";
import { decodeEntities } from "@/lib/sanitize";

export type QuizClue = {
  question: string;
  answer: string;
  category: string;
  difficulty?: string;
};

type Trivia = {
  results?: {
    question: string;
    correct_answer: string;
    category: string;
    difficulty: string;
  }[];
};

const FALLBACK: QuizClue[] = [
  { question: "Столица Франции?", answer: "Париж", category: "География", difficulty: "easy" },
  { question: "Сколько планет в Солнечной системе?", answer: "8", category: "Наука", difficulty: "easy" },
  { question: "Кто написал «Войну и мир»?", answer: "Лев Толстой", category: "Литература", difficulty: "easy" },
  { question: "В каком году человек впервые ступил на Луну?", answer: "1969", category: "История", difficulty: "medium" },
  { question: "Химический символ золота?", answer: "Au", category: "Наука", difficulty: "easy" },
  { question: "Самая длинная река в мире?", answer: "Нил (или Амазонка — по разным методикам)", category: "География", difficulty: "medium" },
  { question: "Сколько клавиш у стандартного фортепиано?", answer: "88", category: "Музыка", difficulty: "medium" },
  { question: "Как называется ближайшая к Солнцу планета?", answer: "Меркурий", category: "Наука", difficulty: "easy" },
];

function pickFallback(): QuizClue {
  return FALLBACK[Math.floor(Math.random() * FALLBACK.length)]!;
}

export const getQuiz = createServerFn({ method: "GET" }).handler(async (): Promise<QuizClue> => {
  try {
    const raw = await fetchJson<Trivia>("https://opentdb.com/api.php?amount=1&type=multiple", 8000);
    const row = raw.results?.[0];
    if (!row) return pickFallback();
    return {
      question: decodeEntities(row.question),
      answer: decodeEntities(row.correct_answer),
      category: decodeEntities(row.category),
      difficulty: row.difficulty,
    };
  } catch {
    return pickFallback();
  }
});
