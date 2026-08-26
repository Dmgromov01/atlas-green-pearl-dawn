type Rec = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: { 0?: { 0?: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop?: () => void;
};

export function startDictation(
  onText: (text: string) => void,
  onError?: (msg: string) => void,
) {
  const SR =
    (window as unknown as { SpeechRecognition?: new () => Rec }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;
  if (!SR) {
    onError?.("Голосовой ввод не поддерживается");
    return null;
  }
  const rec = new SR();
  rec.lang = "ru-RU";
  rec.interimResults = false;
  rec.onresult = (e) => {
    const t = e.results[0]?.[0]?.transcript?.trim();
    if (t) onText(t);
  };
  rec.onerror = () => onError?.("Не удалось распознать речь");
  rec.start();
  return rec;
}
