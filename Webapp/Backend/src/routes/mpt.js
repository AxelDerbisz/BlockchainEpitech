const express = require("express");
const dotenv = require("dotenv");
const { XummSdk } = require("xumm-sdk");
const xrpl = require("xrpl");

const { createTrustlinePayload, issueToUser, balanceOf } = require("../mpt");
const { createPool, buildDepositPayload } = require("../amm");
const { publishPrice, getLatestPrice } = require("../oracle");
const { CURRENCY_CODE, ISSUER_ADDRESS, ISSUER_SEED, NETWORK_URL } = require("../xrplConfig");
const { verifyFirebaseToken, requireAdmin } = require("../middleware/auth");
const { enableRippling } = require("../xrplConfig");

dotenv.config();

const router = express.Router();

xrpl.AMM_DEPOSIT_FLAGS = {
    tfTwoAsset: 0x00100000,      // 1048576
    tfSingleAsset: 0x00200000,   // 2097152
    tfLPToken: 0x00400000,       // 4194304 (optional, for LP deposits)
};

console.log("🔑 XUMM KEYS:", process.env.XUUM_API_PUBLIC_KEY, process.env.XUUM_API_SECRET_KEY);
console.log("💡 TrustSet params:", {
    CURRENCY_CODE,
    ISSUER_ADDRESS
});

const OPERATOR_ADDRESS = ISSUER_ADDRESS;
const OPERATOR_SECRET = process.env.NVDA_ISSUER_SEED;


const xumm = new XummSdk(
    process.env.XUUM_API_PUBLIC_KEY,
    process.env.XUUM_API_SECRET_KEY
);

const AMM_ACCOUNT = "rHDfeMd8nNWXqbAqcD1oPwqNkymHsweyzd";

function toHexCurrencyCode(code) {
    return Buffer.from(code, "utf8").toString("hex").toUpperCase().padEnd(40, "0");
}

router.post("/xrpl/enable-rippling", async (_req, res) => {
    try {
        const result = await enableRippling();
        res.json(result);
    } catch (err) {
        console.error("❌ Ripple enable error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- Basic token info ---
router.get("/mpt/info", (req, res) => res.json({ currency: CURRENCY_CODE }));

// --- MPT (Fungible Token) ---
router.post("/mpt/trustline", async (req, res) => {
    try {
        const { address } = req.body;
        if (!address) return res.status(400).json({ error: "Missing user XRPL address" });

        console.log("💡 TrustSet params:", { CURRENCY_CODE, ISSUER_ADDRESS, address });

        const payloadReq = {
            txjson: {
                TransactionType: "TrustSet",
                Account: address,
                LimitAmount: {
                    currency: toHexCurrencyCode(CURRENCY_CODE),
                    issuer: ISSUER_ADDRESS,
                    value: "1000000000",
                },
                Flags: 262144
            },
            custom_meta: {
                instruction: `Approve trustline for ${CURRENCY_CODE}`,
                txDescription: `Trust ${CURRENCY_CODE} issued by ${ISSUER_ADDRESS}`,
            },
        };

        const payload = await xumm.payload.create(payloadReq);
        if (!payload?.uuid) throw new Error("No payload returned from Xumm SDK");

        res.json({
            uuid: payload.uuid,
            next: payload.next,
            refs: payload.refs,
        });
    } catch (err) {
        console.error("❌ Xumm trustline error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/mpt/issue", verifyFirebaseToken, requireAdmin, async (req, res) => {
    const { destination, amount } = req.body || {};
    if (!destination || !amount)
        return res.status(400).json({ error: "destination and amount required" });

    try {
        console.log(`🚀 Issuing ${amount} NVDA to ${destination}`);

        const payload = await xumm.payload.create({
            txjson: {
                TransactionType: "Payment",
                Account: ISSUER_ADDRESS,
                Destination: destination,
                Amount: {
                    currency: Buffer.from(CURRENCY_CODE, "utf8")
                        .toString("hex")
                        .toUpperCase()
                        .padEnd(40, "0"),
                    issuer: ISSUER_ADDRESS,
                    value: amount.toString(),
                },
            },
            custom_meta: {
                name: "Mint NVDA",
                instruction: `Sign to issue ${amount} NVDA to ${destination}`,
            },
            options: { submit: true },
        });

        console.log("📦 Created mint payload:", payload.uuid);

        res.json({
            uuid: payload.uuid,
            qr: payload.refs.qr_png,
            link: payload.next.always,
        });
    } catch (err) {
        console.error("❌ Xumm mint error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- Balance ---
router.get("/mpt/balance/:address", async (req, res) => {
    try {
        const balance = await balanceOf(req.params.address);
        res.json({ balance });
    } catch (err) {
        console.error("❌ Balance fetch error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- AMM ---
router.post(
    "/amm/create",
    verifyFirebaseToken,
    requireAdmin,
    async (req, res) => {
        const { xrpDrops, nvdaAmount, tradingFee } = req.body || {};
        try {
            const result = await createPool({ xrpDrops, nvdaAmount, tradingFee });
            res.json(result);
        } catch (err) {
            console.error("❌ AMM create error:", err);
            res.status(500).json({ error: err.message });
        }
    }
);

router.post("/amm/deposit/payload", async (req, res) => {
    const { userAddress, fromXRPdrops, fromNVDA } = req.body || {};

    if (!userAddress) {
        return res.status(400).json({ error: "Missing user XRPL address" });
    }

    try {
        console.log(`🚀 Building AMMDeposit payload for ${userAddress}`);

        // Build two-asset deposit
        const txjson = {
            TransactionType: "AMMDeposit",
            Account: userAddress,
            Asset: { currency: "XRP" },
            Asset2: {
                currency: "4E56444100000000000000000000000000000000", // NVDA hex
                issuer: "rGWJSHpjVhBi34szk9iSxYcJEw2r3n6jo4",
            },
            Flags: xrpl.AMMDepositFlags?.tfTwoAsset ?? 0x00100000,
            Amount: String(fromXRPdrops || "1000000"), // default 1 XRP
            Amount2: {
                currency: "4E56444100000000000000000000000000000000",
                issuer: "rGWJSHpjVhBi34szk9iSxYcJEw2r3n6jo4",
                value: String(fromNVDA || "10"),
            },
        };

        // Create payload for user to sign in Xumm
        const payload = await xumm.payload.create({
            txjson,
            custom_meta: {
                name: "Deposit Liquidity to NVDA Pool",
                instruction: `Provide ${(Number(fromXRPdrops) / 1_000_000).toFixed(2)} XRP + ${fromNVDA} NVDA`,
            },
        });

        console.log("✅ Xumm deposit payload:", payload.uuid);

        res.json({
            uuid: payload.uuid,
            qr: payload.refs?.qr_png || payload.qr,
            link: payload.next?.always || payload.next?.signin,
            refs: payload.refs,
            next: payload.next,
        });
    } catch (err) {
        console.error("❌ AMMDeposit payload error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- Oracle ---
router.post(
    "/oracle/publish",
    verifyFirebaseToken,
    requireAdmin,
    async (req, res) => {
        const { priceUsd, symbol = "NVDA", source, extra } = req.body || {};
        if (priceUsd == null)
            return res.status(400).json({ error: "priceUsd required" });

        try {
            const result = await publishPrice({ symbol, priceUsd, source, extra });
            res.json(result);
        } catch (err) {
            console.error("❌ Oracle publish error:", err);
            res.status(500).json({ error: err.message });
        }
    }
);

router.get("/oracle/latest", async (req, res) => {
    try {
        const data = await getLatestPrice();
        if (!data) return res.status(404).json({ error: "No oracle data found" });
        res.json(data);
    } catch (err) {
        console.error("❌ Failed to fetch oracle data:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== AMM SWAP ====================

router.post("/amm/swap/payload", async (req, res) => {
    const { userAddress, fromAmount } = req.body || {};
    const amountDrops = String(fromAmount || "1000000"); // 1 XRP default

    const client = new xrpl.Client(NETWORK_URL);
    await client.connect();

    try {
        console.log("🚀 Starting AMM swap for", userAddress, "amount:", amountDrops);

        const ammInfo = await client.request({
            command: "amm_info",
            asset: { currency: "XRP" },
            asset2: { currency: CURRENCY_HEX, issuer: ISSUER_ADDRESS },
        });

        const pool = ammInfo.result.amm;
        const ratio = Number(pool.amount2.value) / (Number(pool.amount) / 1_000_000);
        const nvdaValue = (Number(fromAmount) / 1_000_000) * ratio;

        console.log(`💱 Pool ratio: 1 XRP = ${ratio.toFixed(6)} NVDA`);
        console.log(`💰 Expect ~${nvdaValue.toFixed(6)} NVDA`);

        const txPayment = {
            TransactionType: "Payment",
            Account: userAddress,
            Destination: userAddress,
            Amount: {
                currency: CURRENCY_HEX,
                issuer: ISSUER_ADDRESS,
                value: nvdaValue.toFixed(6),
            },
            SendMax: amountDrops,
            Flags: xrpl.PaymentFlags.tfPartialPayment,
        };

        const paymentPayload = await xumm.payload.create({
            txjson: txPayment,
            custom_meta: {
                name: "Swap XRP → NVDA",
                instruction: `Swap ${(Number(fromAmount) / 1_000_000).toFixed(
                    2
                )} XRP for ~${nvdaValue.toFixed(2)} NVDA instantly`,
            },
        });

        console.log("🧩 Payment payload created:", paymentPayload.uuid);
        res.json({
            uuid: paymentPayload.uuid,
            refs: paymentPayload.refs,
            next: paymentPayload.next,
        });
    } catch (err) {
        console.error("⚠️ Payment swap path failed, falling back to OfferCreate:", err.message);

        let ratio = 0.3; // fallback
        let usedFallback = true;

        try {
            const oracle = req.app.locals.oracle;
            if (oracle) {
                const latest = await oracle.getPrice(); // returns { asset, value, timestamp }
                if (latest && Number.isFinite(Number(latest.value))) {
                    ratio = Number(latest.value); // NVDA per 1 XRP
                    usedFallback = false;
                }
            }
        } catch (e) {
            console.warn("Oracle price unavailable, using fallback 0.3:", e?.message || e);
        }

        // Compute NVDA amount from XRP drops
        const xrpDrops = Number(fromAmount || 1_000_000); // drops
        const xrpAmount = xrpDrops / 1_000_000;          // XRP
        const nvdaValue = (xrpAmount * ratio).toFixed(6); //

        // === FALLBACK: create OfferCreate ===
        try {
            const fallbackPayload = await xumm.payload.create({
                txjson: {
                    TransactionType: "OfferCreate",
                    Account: req.body.userAddress,
                    TakerGets: String(fromAmount || "1000000"), // XRP in drops
                    TakerPays: {
                        currency: "4E56444100000000000000000000000000000000", // NVDA hex
                        issuer: "rGWJSHpjVhBi34szk9iSxYcJEw2r3n6jo4",
                        value: nvdaValue, // static fallback value
                    },
                    Flags: 131072, // tfImmediateOrCancel
                },
                custom_meta: {
                    name: "Swap XRP → NVDA (Fallback)",
                    instruction: `Fallback DEX swap ${(Number(fromAmount) / 1_000_000).toFixed(
                        2
                    )} XRP → NVDA`,
                },
            });

            console.log("✅ Fallback OfferCreate payload created:", fallbackPayload.uuid);

            res.json({
                uuid: fallbackPayload.uuid,
                refs: fallbackPayload.refs,
                next: fallbackPayload.next,
                fallback: true,
            });
        } catch (fallbackErr) {
            console.error("❌ Fallback OfferCreate failed:", fallbackErr);
            res.status(500).json({ error: fallbackErr.message });
        }
    } finally {
        await client.disconnect();
    }
});

router.post("/amm/withdraw/payload", async (req, res) => {
    try {
        const { userAddress, lpTokenValue } = req.body || {};
        if (!userAddress) return res.status(400).json({ error: "Missing userAddress" });

        // If lpTokenValue is omitted, XRPL withdraws proportionally all owned LP tokens
        const txjson = {
            TransactionType: "AMMWithdraw",
            Account: userAddress,
            AMMAccount: AMM_ACCOUNT,
            Asset: { currency: "XRP" },
            Asset2: { currency: CURRENCY_HEX, issuer: ISSUER_ADDRESS },
            // Optional: Specify how many LP tokens to redeem
            Amount: lpTokenValue ? {
                currency: "0371CAC274569753011F8E78B084A59FC010C5C7", // LP token code
                issuer: AMM_ACCOUNT,
                value: String(lpTokenValue)
            } : undefined,
            Flags: xrpl.AMMWithdrawFlags.tfTwoAsset
        };

        const payload = await xumm.payload.create({
            txjson,
            custom_meta: {
                name: "Withdraw Liquidity",
                instruction: lpTokenValue
                    ? `Withdraw ${lpTokenValue} LP tokens from AMM pool`
                    : "Withdraw all LP shares from the NVDA/XRP pool"
            }
        });

        res.json({
            uuid: payload.uuid,
            refs: payload.refs,
            next: payload.next
        });
    } catch (err) {
        console.error("❌ Withdraw payload error:", err);
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
