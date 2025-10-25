const { xrpl, NETWORK_URL, ISSUER_SEED, CURRENCY_CODE, ISSUER_ADDRESS } = require('./xrplConfig');
const { XummSdk } = require("xumm-sdk");

const xumm = new XummSdk(process.env.XUUM_API_PUBLIC_KEY, process.env.XUUM_API_SECRET_KEY);

function toHexCurrencyCode(code) {
  return Buffer.from(code, "utf8").toString("hex").toUpperCase().padEnd(40, "0");
}

async function withClient(fn) {
  const client = new xrpl.Client(NETWORK_URL);
  await client.connect();
  try { return await fn(client); } finally { client.disconnect(); }
}

function getIssuerWallet() {
  if (!ISSUER_SEED) throw new Error('Missing NVDA_ISSUER_SEED in env');
  return xrpl.Wallet.fromSeed(ISSUER_SEED);
}

async function createTrustlinePayload() {
  return {
    txjson: {
      TransactionType: 'TrustSet',
      LimitAmount: {
        currency: CURRENCY_CODE,
        issuer: getIssuerWallet().classicAddress,
        value: '1000000000'
      }
    }
  };
}

async function issueToUser(destination, amount) {
  try {
    console.log(`Issuing ${amount} ${CURRENCY_CODE} to ${destination}`);

    const payloadReq = {
      txjson: {
        TransactionType: "Payment",
        Account: ISSUER_ADDRESS,
        Destination: destination,
        Amount: {
          currency: toHexCurrencyCode(CURRENCY_CODE),
          issuer: ISSUER_ADDRESS,
          value: amount.toString(),
        },
      },
      custom_meta: {
        name: `Issue ${CURRENCY_CODE}`,
        instruction: `Sign to issue ${amount} ${CURRENCY_CODE} to ${destination}`,
      },
      options: {
        submit: true, 
      },
    };

    const payload = await xumm.payload.create(payloadReq);

    console.log("Created mint payload:", payload.uuid);

    const result = await xumm.payload.get(payload.uuid);
    console.log("Payload result:", result?.response?.txid || "no txid yet");

    return {
      uuid: payload.uuid,
      qr: payload.refs.qr_png,
      link: payload.next.always,
      hash: result?.response?.txid || null,
    };
  } catch (err) {
    console.error("issueToUser error:", err);
    throw err;
  }
}


async function balanceOf(address) {
  return await withClient(async (client) => {
    const issuer = getIssuerWallet();
    const response = await client.request({
      command: "account_lines",
      account: address,
      peer: issuer.classicAddress
    });

    console.log("account_lines:", response.result.lines);

    if (!response.result.lines.length) return "0";

    return response.result.lines[0].balance;
  });
}


module.exports = { createTrustlinePayload, issueToUser, balanceOf, getIssuerWallet };
