import axios from "axios";

const API = process.env.BINANCE_API || "https://api.binance.com";

export async function get24hTicker(symbol) {
  const url = `${API}/api/v3/ticker/24hr`;
  const { data } = await axios.get(url, { params: { symbol } });
  return {
    symbol: data.symbol,
    price: data.lastPrice,
    bid: data.bidPrice,
    ask: data.askPrice,
    volume: data.volume,
    eventTime: new Date(data.closeTime || Date.now()),
  };
}
