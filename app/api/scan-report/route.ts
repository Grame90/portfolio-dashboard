import { NextResponse } from "next/server";

async function extractText(req: Request): Promise<string> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const text = formData.get("text") as string | null;

    if (text) return text;

    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      if (file.type === "application/pdf" || file.name?.endsWith(".pdf")) {
        const pdfParse = require("pdf-parse");
        const result = await pdfParse(buffer);
        return result.text;
      }

      // CSV / TXT
      return buffer.toString("utf-8");
    }
    return "";
  }

  // JSON body with text field
  const body = await req.json();
  return body.text || "";
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "API ключ OpenAI не настроен (OPENAI_API_KEY)" },
        { status: 500 }
      );
    }

    const text = await extractText(req);

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Не удалось извлечь текст из файла" }, { status: 400 });
    }

    const prompt = `Вы — финансовый ассистент. Ниже приведен текст из брокерского отчета (IBKR, Binance, Midas или другой).
Ваша задача: извлечь все операции купли-продажи активов, дивиденды и комиссии.

Верните строго JSON массив объектов следующего формата:
[{
  "date": "ГГГГ-ММ-ДД",
  "ticker": "TICKER",
  "type": "BUY" | "SELL" | "DIVIDEND" | "COMMISSION",
  "qty": число,
  "price": число,
  "amount": число,
  "commission": число,
  "broker": "Название брокера"
}]

Текст отчета:
---
${text.slice(0, 20000)}
---

Важные правила:
1. Верните ТОЛЬКО JSON массив без лишнего текста.
2. Если тикер неясен — определите из контекста.
3. Суммы должны быть положительными числами.
4. Понимаете русский, английский, турецкий и другие языки.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const responseText = data.choices?.[0]?.message?.content ?? "[]";

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    const transactions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json({ transactions });
  } catch (error: any) {
    console.error("AI Parser error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
