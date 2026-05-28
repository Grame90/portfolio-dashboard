import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    const broker = (formData.get("broker") as string) || "";
    const existingRaw = (formData.get("existing") as string) || "[]";

    if (!file) return NextResponse.json({ error: "No image" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mediaType = file.type || "image/jpeg";

    const prompt = `Ты — финансовый ассистент. Проанализируй скриншот брокерского портфеля и извлеки все позиции.

Брокер (если указан пользователем): "${broker || "определи из скриншота"}"

Верни ТОЛЬКО валидный JSON массив без лишнего текста, строго в формате:
[
  {
    "ticker": "AAPL",
    "name": "Apple Inc",
    "type": "Акция",
    "qty": 10,
    "avgPrice": 150.00,
    "broker": "Interactive Brokers"
  }
]

Правила:
- type: одно из ["ETF", "Акция", "Крипто", "Сырьё", "Облигация", "Кэш"]
- Для кэша/валюты: ticker = код валюты (USD, EUR, TRY и т.д.), type = "Кэш", avgPrice = 1 для USD
- qty: точное количество (дробные числа разрешены)
- avgPrice: средняя цена покупки. Если не видна — используй текущую рыночную цену из скриншота
- ticker: стандартный биржевой тикер (BRK.B, не BRK-B)
- broker: название брокера из скриншота или из параметра пользователя

Уже существующие позиции в портфеле (для контекста):
${existingRaw}

Извлеки ВСЕ видимые позиции включая кэш/денежные остатки.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}`, detail: "high" } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "[]";

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ positions: [], raw });

    const positions = JSON.parse(jsonMatch[0]);

    const withIds = positions.map((p: any, i: number) => ({
      id: Date.now() + i,
      ticker: String(p.ticker || "").toUpperCase(),
      name: p.name || p.ticker,
      type: p.type || "ETF",
      qty: Number(p.qty) || 0,
      avgPrice: Number(p.avgPrice) || 0,
      broker: p.broker || broker || "",
      color: "#7c3aed",
      purchaseDate: "",
      action: "hold",
    }));

    return NextResponse.json({ positions: withIds });
  } catch (err: any) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
