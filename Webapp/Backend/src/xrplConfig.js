const xrpl = require('xrpl');
const { XummSdk } = require("xumm-sdk");
const dotenv = require("dotenv");
dotenv.config();

const xumm = new XummSdk(
  process.env.XUUM_API_PUBLIC_KEY,
  process.env.XUUM_API_SECRET_KEY
);

const NETWORK_URL = process.env.XRPL_WSS || 'wss://s.altnet.rippletest.net:51233';

const ISSUER_SEED = process.env.NVDA_ISSUER_SEED;
const ORACLE_SEED = process.env.ORACLE_SEED;
const ISSUER_ADDRESS = process.env.ISSUER_ADDRESS;

const CURRENCY_CODE = process.env.NVDA_CURRENCY || 'NVDA';
const DECIMALS = parseInt(process.env.NVDA_DECIMALS || '6', 10);

async function enableRippling() {
  const payload = await xumm.payload.create({
    txjson: {
      TransactionType: "AccountSet",
      Account: ISSUER_ADDRESS,
      SetFlag: 8, // ✅ Enable DefaultRipple
    },
    custom_meta: {
      instruction: "Enable Default Ripple on Issuer Account",
      txDescription: "This allows tokens to flow through AMM pools.",
    },
  });

  console.log("🌀 Rippling enable payload:", payload);
  return payload;
}

module.exports = {
  xrpl,
  NETWORK_URL,
  ISSUER_SEED,
  ORACLE_SEED,
  CURRENCY_CODE,
  ISSUER_ADDRESS,
  DECIMALS,
  enableRippling
};
