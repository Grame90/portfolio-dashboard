import { NextResponse } from 'next/server';
import crypto from 'crypto';

const API_KEY = process.env.BYBIT_API_SECRET; // Swapped as per user suggestion
const API_SECRET = process.env.BYBIT_API_KEY; // Swapped as per user suggestion
const BASE_URL = 'https://api.bybit.com';

function generateSignature(params: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(params).digest('hex');
}

export async function GET() {
  if (!API_KEY || !API_SECRET) {
    return NextResponse.json({ error: 'Ключи Bybit API не настроены в .env.local' }, { status: 500 });
  }

  const timestamp = Date.now().toString();
  const recvWindow = '10000'; // Increased window
  const queryString = 'accountType=UNIFIED';

  try {
    const signature = generateSignature(timestamp + API_KEY + recvWindow + queryString, API_SECRET);
    const url = `${BASE_URL}/v5/account/wallet-balance?${queryString}`;
    
    console.log('Fetching Bybit Unified:', url);
    
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-BAPI-API-KEY': API_KEY,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
      },
    });

    let text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Bybit response is not JSON:', text);
      return NextResponse.json({ error: `Bybit Error: Некорректный ответ от сервера (${response.status})` }, { status: 500 });
    }

    // If Unified fails (e.g. account not unified), try SPOT
    if (data.retCode !== 0) {
       console.log('Unified failed, trying SPOT. Code:', data.retCode, 'Msg:', data.retMsg);
       const spotQuery = 'accountType=SPOT';
       const spotSignature = generateSignature(timestamp + API_KEY + recvWindow + spotQuery, API_SECRET);
       const spotUrl = `${BASE_URL}/v5/account/wallet-balance?${spotQuery}`;
       
       response = await fetch(spotUrl, {
          method: 'GET',
          headers: {
            'X-BAPI-API-KEY': API_KEY,
            'X-BAPI-SIGN': spotSignature,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
          },
        });
        text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (e) {
          return NextResponse.json({ error: `Bybit Spot Error: Некорректный ответ (${response.status})` }, { status: 500 });
        }
    }

    if (data.retCode !== 0) {
      return NextResponse.json({ error: `Bybit Error ${data.retCode}: ${data.retMsg}` }, { status: 400 });
    }

    // Extract coins with balance > 0
    const list = data.result?.list?.[0]?.coin || [];
    const balances = list
      .filter((c: any) => parseFloat(c.walletBalance || c.equity || '0') > 0)
      .map((c: any) => ({
        ticker: c.coin,
        qty: parseFloat(c.walletBalance || c.equity || '0'),
        type: 'Крипто',
        broker: 'Bybit'
      }));

    if (balances.length === 0) {
      return NextResponse.json({ error: 'Bybit: Балансы не найдены или равны 0' }, { status: 404 });
    }

    return NextResponse.json({ balances });
  } catch (error: any) {
    console.error('Bybit integration error:', error);
    return NextResponse.json({ error: 'Ошибка подключения к Bybit: ' + error.message }, { status: 500 });
  }
}
