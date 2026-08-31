export function botToken() {
  return (process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "").trim();
}

export async function notifyTelegram(chatId: number | string, text: string) {
  const token = botToken();
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 1500), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* optional pager failure */
  }
}
