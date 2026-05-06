import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event, actual, estimate, prev, kind, ticker } = body;

    const hasFact = actual != null && actual !== "—";

    const contextLine = [
      ticker ? `Инструмент: ${ticker}` : null,
      `Тип: ${kind === "earnings" ? "Квартальный отчёт" : kind === "dividend" ? "Дивиденды" : "Макроэкономика"}`,
      estimate ? `Прогноз: ${estimate}` : null,
      prev      ? `Предыдущее значение: ${prev}` : null,
      hasFact   ? `Фактическое значение: ${actual}` : null,
    ].filter(Boolean).join(" | ");

    const prompt = hasFact
      ? `Ты опытный финансовый аналитик. Дай краткий экспертный комментарий (3–4 предложения, на русском языке) к макроэкономическому событию или отчёту:\n\nСобытие: «${event}»\n${contextLine}\n\nПроанализируй: отклонение факта от прогноза, что это значит для рынка и монетарной политики ФРС, как это влияет на инвесторов. Пиши как профессиональный аналитик, без воды.`
      : `Ты опытный финансовый аналитик. Дай краткий экспертный предварительный обзор (3–4 предложения, на русском языке) предстоящего события:\n\nСобытие: «${event}»\n${contextLine}\n\nЧто ожидает рынок, какова вероятная реакция при отклонении от прогноза, на что обратить внимание инвесторам. Пиши как профессиональный аналитик, без воды.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ analysis: null, error: err }, { status: res.status });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ analysis: text });
  } catch (err: any) {
    console.error("Analysis error:", err);
    return NextResponse.json({ analysis: null, error: err.message }, { status: 500 });
  }
}
