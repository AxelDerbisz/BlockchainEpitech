require('dotenv').config();
const { XummSdk } = require('xumm-sdk');
const express = require('express');
const cors = require('cors');
const XRPLIndexer = require('./indexer');
const routes = require('./routes');
const http = require('http');
const { WebSocketServer } = require('ws');
const admin = require("firebase-admin");
const { CURRENCY_CODE, ISSUER_ADDRESS, ISSUER_SEED, NETWORK_URL, ORACLE_SEED } = require("./xrplConfig");

const app = express();
const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.RPC_URL;
const START_BLOCK = parseInt(process.env.START_BLOCK || 0);
const xumm = new XummSdk(process.env.XUUM_API_PUBLIC_KEY, process.env.XUUM_API_SECRET_KEY);
const signedPayloads = new Map();
const xrpl = require('xrpl');
const mptRoutes = require('./routes/mpt');
const Oracle = require('./oracle');

const oracle = new Oracle(NETWORK_URL, ORACLE_SEED)
const XRPL_TESTNET = 'wss://s.altnet.rippletest.net:51233';

const XRPL_WSS_URL = process.env.XRPL_WSS_URL || 'wss://testnet.xrpl-labs.com';
const START_LEDGER = parseInt(process.env.START_LEDGER || 0);

function toHexUtf8(str) {
  return Buffer.from(str, 'utf8').toString('hex').toUpperCase();
}
const NFT_FLAG_BURNABLE = 0x00000001;
const NFT_FLAG_TRANSFERABLE = 0x00000008;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);


app.use(express.json());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl / healthz
    const ok = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
    cb(ok ? null : new Error("CORS blocked"), ok);
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

// pollIncomingPayments();
app.locals.oracle = oracle;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// setInterval(oracle.updatePrice.bind(oracle), 5 * 60 * 1000).unref();

wss.on('connection', (ws) => {
  console.log('Nouveau client WebSocket connecté');
  ws.send(JSON.stringify({
    type: 'status',
    data: { message: 'Connecté au backend indexer XRPL' }
  }));

  ws.on('error', (error) => {
    console.error('Erreur WebSocket:', error.message);
  });

  ws.on('close', () => {
    console.log('Client WebSocket déconnecté');
  });
});

function broadcastToClients(type, data) {
  const payload = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      try {
        client.send(payload);
      } catch (error) {
        console.error('Erreur envoi WS:', error.message);
      }
    }
  });
}

const indexer = new XRPLIndexer(XRPL_WSS_URL);
app.locals.indexer = indexer;

indexer.onNewEvent = (event) => {
  broadcastToClients('new_event', event);
};

indexer.onNewLedger = (ledger) => {
  broadcastToClients('new_ledger', ledger);
};

app.use('/api', routes);
app.use('/api', express.json(), mptRoutes);

app.get("/healthz", (_req, res) => res.send("ok"));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    indexer: {
      running: indexer.isRunning,
      connected: indexer.client ? indexer.client.isConnected() : false,
      stats: indexer.getStats(),
    },
  });
});

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

app.get("/api/connect", async (req, res) => {
  try {
    const payload = await xumm.payload.create({
      txjson: { TransactionType: "SignIn" },
    });

    console.log("New payload:", payload.uuid);

    const subscription = await xumm.payload.subscribe(payload.uuid, async (event) => {
      if (event.data.signed === true) {
        const result = await xumm.payload.get(payload.uuid);
        signedPayloads.set(payload.uuid, {
          signed: true,
          account: result.response.account,
        });
        console.log("Wallet signed:", result.response.account);
        subscription.unsubscribe();
        if (typeof localStorage !== "undefined") {
          localStorage.setItem('xrplAccount', result.response.account);
        }
      } else if (event.data.signed === false) {
        signedPayloads.set(payload.uuid, { signed: false });
        console.log("Signature refused");
        subscription.unsubscribe();
      } else {
        signedPayloads.set(payload.uuid, { signed: false });
        subscription.unsubscribe();
      }
    });

    res.json({
      uuid: payload.uuid,
      qr: payload.refs.qr_png,
      link: payload.next.always,
    });
  } catch (error) {
    console.error("Error creating payload:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/status/:uuid", (req, res) => {
  const uuid = req.params.uuid;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const existing = signedPayloads.get(uuid);
  if (existing) {
    res.write(`data: ${JSON.stringify(existing)}\n\n`);
    signedPayloads.delete(uuid);
    return res.end();
  }

  const interval = setInterval(() => {
    const result = signedPayloads.get(uuid);
    if (result) {
      res.write(`data: ${JSON.stringify(result)}\n\n`);
      clearInterval(interval);
      signedPayloads.delete(uuid);
      res.end();
    }
  }, 1000);

  req.on("close", () => clearInterval(interval));
});
app.post("/api/marketplace/sell", async (req, res) => {
  const { account, nftId, price, uri } = req.body;
  if (!account || !nftId || !price)
    return res.status(400).json({ error: "Missing required fields" });

  const drops = xrpl.xrpToDrops(price);

  try {
    const payload = await xumm.payload.create({
      txjson: {
        TransactionType: "NFTokenCreateOffer",
        Account: account,
        NFTokenID: nftId,
        Amount: drops,
        Flags: 1,
      },
      custom_meta: {
        name: "List NFT for Sale",
        instruction: "Sign this to list your NFT for sale on the marketplace.",
      },
    });

    res.json({
      uuid: payload.uuid,
      qr: payload.refs.qr_png,
      link: payload.next.always,
    });

    console.log("Waiting for seller signature...");
    let signedPayload;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const check = await xumm.payload.get(payload.uuid);
      if (check?.meta?.signed) {
        signedPayload = check;
        console.log(" Seller signed payload");
        break;
      }
      if (check?.meta?.expired) {
        console.warn("Payload expired");
        return;
      }
    }

    if (!signedPayload) {
      console.warn("Seller never signed the offer.");
      return;
    }

    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
    await client.connect();

    let offerIndex = null;
    for (let i = 0; i < 10; i++) {
      const offers = await client.request({
        command: "nft_sell_offers",
        nft_id: nftId,
      });

      if (offers.result?.offers?.length > 0) {
        offerIndex = offers.result.offers[0].nft_offer_index;
        console.log(" Offer found:", offerIndex);
        break;
      }
      console.log("Waiting for offer to appear on XRPL...");
      await new Promise((r) => setTimeout(r, 2000));
    }

    await client.disconnect();

    await db.collection("marketplace_listings").doc(nftId).set({
      nftId,
      seller: account,
      price,
      uri: uri || "",
      createdAt: Date.now(),
      active: true,
      payloadUuid: payload.uuid,
      offerIndex: offerIndex || null,
    });

    console.log(" NFT listed successfully on marketplace.");
  } catch (err) {
    console.error("Sell error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/marketplace/confirm-sell", async (req, res) => {
  const { nftId } = req.body;
  if (!nftId) return res.status(400).json({ error: "Missing nftId" });

  await db.collection("marketplace_listings").doc(nftId).update({ active: true });
  res.json({ success: true });
});

app.get("/api/marketplace/list", async (req, res) => {
  const snap = await db
    .collection("marketplace_listings")
    .where("active", "==", true)
    .get();

  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const client = new xrpl.Client(XRPL_TESTNET);
  try {
    await client.connect();
    const out = [];
    for (const it of items) {
      try {
        const r = await client.request({ command: "account_nfts", account: it.seller, limit: 400 });
        const stillOwns = (r.result.account_nfts || []).some((n) => n.NFTokenID === it.nftId);
        if (stillOwns) {
          out.push(it);
        } else {
          await db.collection("marketplace_listings").doc(it.nftId).set({ active: false }, { merge: true });
        }
      } catch (e) {
        console.warn("Ownership check failed for", it.nftId, e.message);
        out.push(it);
      }
    }
    res.json(out);
  } catch (err) {
    console.error("list error:", err);
    res.json(items);
  } finally {
    try { await client.disconnect(); } catch { }
  }
});

app.post("/api/marketplace/offer", async (req, res) => {
  const { account, nftId, amount } = req.body;
  if (!account || !nftId || !amount)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const payload = await xumm.payload.create({
      txjson: {
        TransactionType: "NFTokenCreateOffer",
        Account: account,
        NFTokenID: nftId,
        Amount: xrpl.xrpToDrops(amount),
        Flags: 0,
      },
      custom_meta: {
        name: "Make NFT Offer",
        instruction: "Sign to place your offer on this NFT.",
      },
    });

    await db.collection("marketplace_offers").add({
      nftId,
      offerer: account,
      amount,
      createdAt: Date.now(),
      accepted: false,
      payloadUuid: payload.uuid,
    });

    res.json({ uuid: payload.uuid, qr: payload.refs.qr_png, link: payload.next.always });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/marketplace/offers/:nftId", async (req, res) => {
  const { nftId } = req.params;
  const snap = await db
    .collection("marketplace_offers")
    .where("nftId", "==", nftId)
    .get();
  res.json(snap.docs.map((d) => d.data()));
});

app.post("/api/xumm/callback", express.json(), (req, res) => {
  const { payload_uuidv4, signed, txid, account } = req.body;
  console.log("📬 XUMM callback:", payload_uuidv4, signed);
  signedPayloads.set(payload_uuidv4, { signed, txid, account });
  res.sendStatus(200);
});


app.post('/api/nft/mint', async (req, res) => {
  console.log("➡️ /api/nft/mint called with:", req.body);
  try {
    const {
      metadataUrl,
      transferable = true,
      burnable = false,
      taxon = 0,
      transferFeeBps = 0
    } = req.body || {};

    if (!metadataUrl || typeof metadataUrl !== 'string') {
      return res.status(400).json({ error: 'metadataUrl is required' });
    }
    if (transferFeeBps < 0 || transferFeeBps > 50000) {
      return res.status(400).json({ error: 'transferFeeBps must be 0..50000' });
    }

    let Flags = 0;
    if (transferable) Flags |= NFT_FLAG_TRANSFERABLE;
    if (burnable) Flags |= NFT_FLAG_BURNABLE;

    const payloadReq = {
      txjson: {
        TransactionType: 'NFTokenMint',
        URI: toHexUtf8(metadataUrl),
        Flags,
        NFTokenTaxon: taxon,
        ...(transferFeeBps > 0 ? { TransferFee: transferFeeBps } : {}),
      },
      custom_meta: {
        name: 'Mint NFT (XLS-20)',
        instruction: 'Review & sign to mint your NFT on XRPL testnet.',
      },
      options: {
        submit: true
      }
    };

    const payload = await xumm.payload.create(payloadReq);
    const uuid = payload.uuid;

    const subscription = await xumm.payload.subscribe(uuid, async (event) => {
      if (event.data.signed === true) {
        const result = await xumm.payload.get(uuid);
        signedPayloads.set(uuid, {
          type: 'mint',
          signed: true,
          account: result.response.account,
          txid: result.response.txid || null
        });

        subscription.unsubscribe();
      } else if (event.data.signed === false) {
        signedPayloads.set(uuid, { type: 'mint', signed: false });
        subscription.unsubscribe();
      } else if (event.data.expired === true) {
        signedPayloads.set(uuid, { type: 'mint', signed: false, expired: true });
        subscription.unsubscribe();
      }
    });

    console.log("Mint request body:", req.body);
    res.json({
      uuid,
      qr: payload.refs.qr_png,
      link: payload.next.always
    });

  } catch (error) {
    console.error('Error creating NFT mint payload:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/nft/list/:account', async (req, res) => {
  const { account } = req.params;
  if (!account) return res.status(400).json({ error: 'account required' });

  const client = new xrpl.Client(XRPL_TESTNET);
  try {
    await client.connect();
    const r = await client.request({
      command: 'account_nfts',
      account,
      limit: 400
    });
    res.set('Cache-Control', 'no-store');
    res.json(r.result);
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  } finally {
    try { await client.disconnect(); } catch { }
  }
});

app.post("/api/nft/burn", async (req, res) => {
  const { account, NFTokenID } = req.body;
  if (!account || !NFTokenID)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const payload = await xumm.payload.create({
      txjson: {
        TransactionType: "NFTokenBurn",
        Account: account,
        NFTokenID,
      },
      custom_meta: {
        instruction: "Sign to burn your NFT from XRPL Testnet.",
      },
    });
    const uuid = payload.uuid;
    const subscription = await xumm.payload.subscribe(uuid, async (event) => {
      if (event.data.signed === true) {
        console.log(`NFT ${NFTokenID} burned — cleaning Firestore listing`);

        try {
          const listingRef = db.collection("marketplace_listings").doc(NFTokenID);
          const doc = await listingRef.get();

          if (doc.exists) {
            await listingRef.delete();
            console.log(` Listing for NFT ${NFTokenID} deleted from marketplace`);
          } else {
            console.log(`No active listing found for ${NFTokenID}`);
          }
        } catch (dbErr) {
          console.error("Error deleting NFT listing:", dbErr);
        }
        signedPayloads.set(uuid, { signed: true, account });
      } else if (event.data.signed === false) {
        signedPayloads.set(uuid, { signed: false });
      } else if (event.data.expired === true) {
        signedPayloads.set(uuid, { signed: false, expired: true });
      }
    });

    res.json({
      uuid,
      qr: payload.refs.qr_png,
      link: payload.next.always,
    });
  } catch (err) {
    console.error(" Error creating burn payload:", err);
    res.status(500).json({ error: err.message || "Failed to create burn payload" });
  }
});

app.post("/api/marketplace/buy", async (req, res) => {
  const { buyer, nftId } = req.body;
  if (!buyer || !nftId) return res.status(400).json({ error: "Missing buyer or nftId" });

  const docRef = db.collection("marketplace_listings").doc(nftId);
  const docSnap = await docRef.get();
  const listing = docSnap.exists ? docSnap.data() : null;
  if (!listing || !listing.active) return res.status(404).json({ error: "NFT not found or inactive" });

  const client = new xrpl.Client(XRPL_TESTNET);
  await client.connect();

  let offerIndex = listing.offerIndex;

  if (!offerIndex) {
    const offers = await client.request({ command: "nft_sell_offers", nft_id: nftId });
    offerIndex = offers.result.offers?.[0]?.nft_offer_index;
  }

  if (!offerIndex) {
    await client.disconnect();
    return res.status(404).json({ error: "Offer not found on XRPL" });
  }

  const payload = await xumm.payload.create({
    txjson: {
      TransactionType: "NFTokenAcceptOffer",
      Account: buyer,
      NFTokenSellOffer: offerIndex,
    },
    custom_meta: {
      name: "Buy NFT",
      instruction: "Sign to buy this NFT.",
    },
    options: { submit: true }
  });

  res.json({ uuid: payload.uuid, qr: payload.refs.qr_png, link: payload.next.always });

  const uuid = payload.uuid;
  const subscription = await xumm.payload.subscribe(uuid, async (event) => {
    try {
      if (event.data.signed !== true) {
        if (event.data.signed === false) {
          signedPayloads.set(uuid, { signed: false });
        } else if (event.data.expired) {
          signedPayloads.set(uuid, { signed: false, expired: true });
        }
        subscription.unsubscribe();
        return;
      }

      const full = await xumm.payload.get(uuid);
      const txid = full.response?.txid || null;

      const waitForValidated = async (hash, timeoutMs = 60000) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          try {
            const r = await client.request({ command: "tx", transaction: hash });
            if (r.result && r.result.validated) return r.result;
          } catch { }
          await new Promise((r) => setTimeout(r, 2000));
        }
        throw new Error("Timed out waiting for validation");
      };

      if (txid) {
        try { await waitForValidated(txid); } catch (e) { console.warn("Validation wait:", e.message); }
      } else {
        await new Promise((r) => setTimeout(r, 5000));
      }

      const buyerNfts = await client.request({ command: "account_nfts", account: buyer, limit: 400 });
      const buyerOwns = (buyerNfts.result.account_nfts || []).some((n) => n.NFTokenID === nftId);

      const sellerNfts = await client.request({ command: "account_nfts", account: listing.seller, limit: 400 });
      const sellerStillOwns = (sellerNfts.result.account_nfts || []).some((n) => n.NFTokenID === nftId);

      if (buyerOwns && !sellerStillOwns) {
        await docRef.set(
          {
            active: false,
            soldAt: Date.now(),
            buyer,
            txid: txid || null,
          },
          { merge: true }
        );
      } else {
        console.warn("Ledger reconciliation mismatch: buyerOwns=", buyerOwns, "sellerStillOwns=", sellerStillOwns);
      }

      signedPayloads.set(uuid, { signed: true, txid, buyer, nftId });
      subscription.unsubscribe();
    } catch (e) {
      console.error("Buy subscription error:", e);
      subscription.unsubscribe();
    }
  });

  await client.disconnect();
});

server.listen(PORT, async () => {
  console.log(`\nServeur HTTP + WS démarré sur le port ${PORT}`);
  console.log(`XRPL WebSocket: ${XRPL_WSS_URL}`);

  try {
    await indexer.startListener(db);
    indexer.startHealthCheck(30000);

    console.log('Indexeur XRPL prêt et à l\'écoute\n');

  } catch (error) {
    console.error('Erreur démarrage indexeur:', error.message);
    console.log('Tentative de reconnexion...');
  }
});

process.on('SIGINT', async () => {
  console.log('\nArrêt du serveur...');
  indexer.stopHealthCheck();
  await indexer.stopListener();
  server.close(() => {
    console.log('Serveur arrêté proprement');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\nArrêt du serveur (SIGTERM)...');
  indexer.stopHealthCheck();
  await indexer.stopListener();
  server.close(() => {
    console.log('Serveur arrêté proprement');
    process.exit(0);
  });
});

module.exports = app;
