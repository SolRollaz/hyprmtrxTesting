// File: /HVM/valueChecker.js

const axios = require('axios');
const NodeCache = require('node-cache');
const winston = require('winston');

const FALLBACK_PRICE_USD = 1.0;
const cache = new NodeCache({ stdTTL: 60 }); // 1 minute cache

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

async function getExpectedTokenAmount(priceInUSDC, tokenContractAddress, network) {
  const sources = [
    fetchFromCoinGecko,
    fetchFromCoinMarketCap,
    fetchFromDexTools,
    fetchFromDefiLlama
  ];

  const priceResults = await Promise.all(
    sources.map((fn) => fn(tokenContractAddress, network))
  );

  const validPrices = priceResults.filter(p => typeof p === 'number' && p > 0);

  if (validPrices.length === 0) {
    logger.warn(`All price sources failed. Using fallback price.`);
    return priceInUSDC / FALLBACK_PRICE_USD;
  }

  const avgPrice = validPrices.reduce((sum, val) => sum + val, 0) / validPrices.length;
  return priceInUSDC / avgPrice;
}

async function fetchFromCoinGecko(contract, network) {
  const key = `coingecko-${network}-${contract}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const url = `https://api.coingecko.com/api/v3/simple/token_price/${network}?contract_addresses=${contract}&vs_currencies=usd`;
    const { data } = await axios.get(url);
    const price = Object.values(data)?.[0]?.usd;
    if (price) {
      cache.set(key, price);
      logger.info(`CoinGecko price for ${contract}: $${price}`);
    }
    return price || null;
  } catch (err) {
    logger.warn(`CoinGecko failed: ${err.message}`);
    return null;
  }
}

async function fetchFromCoinMarketCap(contract, network) {
  const key = `cmc-${network}-${contract}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest`;
    const response = await axios.get(url, {
      headers: { 'X-CMC_PRO_API_KEY': '6241475e-61b5-44ab-a9be-844ea15835d6' },
      params: {
        address: contract,
        convert: 'USD'
      }
    });
    const price = Object.values(response.data.data)[0]?.quote?.USD?.price;
    if (price) {
      cache.set(key, price);
      logger.info(`CoinMarketCap price for ${contract}: $${price}`);
    }
    return price || null;
  } catch (err) {
    logger.warn(`CoinMarketCap failed: ${err.message}`);
    return null;
  }
}

async function fetchFromDexTools(contract, network) {
  const key = `dextools-${network}-${contract}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${contract}`;
    const { data } = await axios.get(url);
    const price = data?.pairs?.[0]?.priceUsd;
    if (price) {
      cache.set(key, parseFloat(price));
      logger.info(`DexTools price for ${contract}: $${price}`);
    }
    return price ? parseFloat(price) : null;
  } catch (err) {
    logger.warn(`DexTools failed: ${err.message}`);
    return null;
  }
}

async function fetchFromDefiLlama(contract, network) {
  const key = `llama-${network}-${contract}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const url = `https://coins.llama.fi/prices/current/${network}:${contract}`;
    const { data } = await axios.get(url);
    const price = Object.values(data.coins)?.[0]?.price;
    if (price) {
      cache.set(key, price);
      logger.info(`DefiLlama price for ${contract}: $${price}`);
    }
    return price || null;
  } catch (err) {
    logger.warn(`DefiLlama failed: ${err.message}`);
    return null;
  }
}

module.exports = { getExpectedTokenAmount };
