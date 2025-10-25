const { XummSdk } = require("xumm-sdk");
const { CURRENCY_CODE, ISSUER_ADDRESS } = require("./xrplConfig");
const dotenv = require("dotenv");
dotenv.config();

const xumm = new XummSdk(
  process.env.XUUM_API_PUBLIC_KEY,
  process.env.XUUM_API_SECRET_KEY
);

function toHexCurrencyCode(code) {
  return Buffer.from(code, "utf8").toString("hex").toUpperCase().padEnd(40, "0");
}


async function withClient(fn){
  const client = new xrpl.Client(NETWORK_URL);
  await client.connect();
  try { return await fn(client); } finally { client.disconnect(); }
}

async function createPool({ xrpDrops, nvdaAmount, tradingFee }) {
  console.log("🚀 Creating AMM Pool with:", { xrpDrops, nvdaAmount, tradingFee });

  // --- validation ---
  if (!xrpDrops || !nvdaAmount) {
    throw new Error("Missing required parameters (xrpDrops, nvdaAmount)");
  }
  if (isNaN(tradingFee)) {
    throw new Error("TradingFee must be a number");
  }

  // --- XRPL AMMCreate transaction ---
  const txjson = {
    TransactionType: "AMMCreate",
    Account: ISSUER_ADDRESS,
    Amount: String(xrpDrops), // XRP in drops
    Amount2: {
      currency: toHexCurrencyCode(CURRENCY_CODE), // properly encoded
      issuer: ISSUER_ADDRESS,
      value: String(nvdaAmount),
    },
    TradingFee: Math.floor(tradingFee * 1000), // e.g. 0.002 -> 2
  };

  console.log("📦 AMMCreate txjson:", txjson);

  const payloadReq = {
    txjson,
    custom_meta: {
      instruction: `Create AMM Pool for ${CURRENCY_CODE}/XRP`,
      txDescription: `Deposit ${nvdaAmount} ${CURRENCY_CODE} + ${xrpDrops} drops of XRP`,
    },
  };

  const payload = await xumm.payload.create(payloadReq);
  console.log("🧩 Created XUMM payload:", payload);

  if (!payload?.uuid) throw new Error("No XUMM payload UUID returned");

  return {
    uuid: payload.uuid,
    next: payload.next,
    refs: payload.refs,
  };
}

function buildDepositPayload({ fromXRPdrops, fromNVDA, twoAsset = true }){
  const issuer = getIssuerWallet();
  const payload = {
    txjson: {
      TransactionType: 'AMMDeposit',
      Asset: { currency: 'XRP' },
      Asset2: { currency: CURRENCY_CODE, issuer: issuer.classicAddress },
      Flags: twoAsset ? xrpl.AMM_DEPOSIT_FLAGS.tfTwoAsset
                      : xrpl.AMM_DEPOSIT_FLAGS.tfSingleAsset
    }
  };
  if (fromXRPdrops) payload.txjson.Amount = String(fromXRPdrops);
  if (fromNVDA) payload.txjson.Amount2 = { currency: CURRENCY_CODE, issuer: issuer.classicAddress, value: String(fromNVDA) };
  return payload;
}

module.exports = { createPool, buildDepositPayload };
