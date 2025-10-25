const express = require("express");
const router = express.Router();
const { XummSdk } = require("xumm-sdk");
const { db } = require("../firebaseAdmin.js");

const xumm = new XummSdk(process.env.XUUM_API_PUBLIC_KEY, process.env.XUUM_API_SECRET_KEY);

router.get("/users", async (req, res) => {
    try {
        const snapshot = await db.collection("users").get();
        const users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.json({ count: users.length, users });
    } catch (error) {
        console.error("Erreur Firestore /users:", error);
        res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs" });
    }
});

router.get("/events/latest", (req, res) => {
    const events = req.app.locals.indexer.getEvents().slice(-10).reverse();
    res.json({ count: events.length, events });
});

router.get("/ledgers/latest", (req, res) => {
    const ledgers = req.app.locals.indexer.latestLedgers || [];
    res.json({ count: ledgers.length, ledgers });
});


router.get("/events", (req, res) => {
    const { from, to, type, limit } = req.query;

    const filters = {};
    if (from) filters.from = from;
    if (to) filters.to = to;
    if (type) filters.type = type;

    let events = req.app.locals.indexer.getEvents(filters);
    if (limit) {
        events = events.slice(0, parseInt(limit));
    }

    res.json({
        count: events.length,
        events,
    });
});

router.get("/events/:txHash", (req, res) => {
    const events = req.app.locals.indexer.getEvents({ transactionHash: req.params.txHash });
    if (events.length === 0) {
        return res.status(404).json({ error: "Événement non trouvé" });
    }
    res.json(events[0]);
});


router.get("/transfers/from/:address", (req, res) => {
    const events = req.app.locals.indexer.getEvents({ from: req.params.address });
    res.json({
        address: req.params.address,
        transfersCount: events.length,
        transfers: events,
    });
});

router.get("/transfers/to/:address", (req, res) => {
    const events = req.app.locals.indexer.getEvents({ to: req.params.address });
    res.json({
        address: req.params.address,
        transfersCount: events.length,
        transfers: events,
    });
});

router.get("/stats", (req, res) => {
    const stats = req.app.locals.indexer.getStats();
    res.json({
        ...stats,
        timestamp: new Date().toISOString(),
    });
});

router.get("/status", (req, res) => {
    const stats = req.app.locals.indexer.getStats();
    res.json({
        status: stats.isRunning ? "running" : "stopped",
        stats,
        timestamp: new Date().toISOString(),
    });
});

router.post("/restart", async (req, res) => {
    try {
        const indexer = req.app.locals.indexer;
        console.log("🔄 Redémarrage manuel de l'indexeur...");

        indexer.stopListener();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await indexer.startListener();

        res.json({
            status: "success",
            message: "Indexeur redémarré",
            stats: indexer.getStats(),
        });
    } catch (error) {
        res.status(500).json({
            error: "Erreur lors du redémarrage",
            message: error.message,
        });
    }
});

router.get('/latest', async (req, res) => {
    try {
        const oracle = req.app.locals.oracle;
        const price = await oracle.getPrice();

        if (!price) {
            return res
                .status(404)
                .json({ error: 'Prix introuvable pour cet actif.' });
        }

        res.json({
            symbol: 'XRP/NVDA',
            price: price.value,
            updatedAt: price.timestamp,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send(
            'Erreur lors de la récupération du prix sur XRPL.'
        );
    }
});

router.post('/publish', async (req, res) => {
    try {
        const oracle = req.app.locals.oracle;
        const tx = await oracle.updatePrice();

        res.json({ tx });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur lors de la mise à jour du prix sur XRPL.');
    }
});



router.post("/health-check", async (req, res) => {
    try {
        const indexer = req.app.locals.indexer;
        const healthy = indexer.isRunning && indexer.currentLedger > 0;

        res.json({
            healthy,
            stats: indexer.getStats(),
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({
            error: "Erreur lors de la vérification",
            message: error.message,
        });
    }
});


router.post("/nft/sell", async (req, res) => {
    try {
        const { nftId, amountDrops } = req.body;
        if (!nftId || !amountDrops) {
            return res.status(400).json({ error: "Missing nftId or amountDrops" });
        }

        const payload = await xumm.payload.create({
            txjson: {
                TransactionType: "NFTokenCreateOffer",
                NFTokenID: nftId,
                Amount: String(amountDrops),
                Flags: 1, // tfSellNFToken
            },
            custom_meta: {
                name: "List NFT for Sale",
                instruction: "Sign to list your NFT on XRPL Testnet.",
            },
            options: { submit: true },
        });

        res.json({
            uuid: payload.uuid,
            qr: payload.refs.qr_png,
            link: payload.next.always,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
