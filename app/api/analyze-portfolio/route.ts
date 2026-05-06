import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { positions, totalValue } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'API ключ OpenAI не настроен (OPENAI_API_KEY)' },
        { status: 500 }
      );
    }

    if (!positions || positions.length === 0) {
      return NextResponse.json(
        { result: 'Ваш портфель пуст. Добавьте позиции для анализа.' }
      );
    }

    const prompt = `Вы — профессиональный финансовый консультант. Проанализируйте следующий инвестиционный портфель.
Общая стоимость: $${totalValue}.
Позиции: ${JSON.stringify(positions.map((p: any) => ({ ticker: p.ticker, type: p.type, quantity: p.qty, value: p.qty * p.avgPrice })))}.

Предоставьте краткий, но емкий анализ, сфокусированный на:
1) Диверсификация активов
2) Уровень риска
3) Конкретные рекомендации по улучшению или ребалансировке.

Используйте разметку Markdown (заголовки, списки). Ответ должен быть на русском языке. Не пишите вступлений, переходите сразу к анализу.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? 'Нет ответа от ИИ';

    return NextResponse.json({ result: text });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
