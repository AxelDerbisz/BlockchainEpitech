const fs = require('fs');
const path = require('path');
const xrpl = require('xrpl');

class XRPLIndexer {
    constructor(wssUrl = 'wss://s.altnet.rippletest.net:51233') {
        this.wssUrl = wssUrl;
        this.client = null;
        this.events = [];
        this.isRunning = false;
        this.dataFile = path.join(__dirname, 'indexed_events.json');
        this.currentLedger = 0;
        this.retryAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000;
        this.healthCheckInterval = null;
        this.userAddresses = [];
        this.reconnectTimeout = null;
        this.onNewEvent = null;
        this.onNewLedger = null;
        this.loadEvents();
    }

    loadEvents() {
        if (fs.existsSync(this.dataFile)) {
            try {
                const data = fs.readFileSync(this.dataFile, 'utf8');
                this.events = JSON.parse(data);
                console.log(`${this.events.length} événements XRPL chargés`);
            } catch (error) {
                console.error('Erreur chargement événements:', error.message);
                this.events = [];
            }
        }
    }

    saveEvents() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.events, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde:', error.message);
        }
    }

    async loadUserAddresses(db) {
        try {
            const snapshot = await db.collection("users").get();
            this.userAddresses = snapshot.docs
                .map(doc => doc.data().address)
                .filter(addr => !!addr);
            return this.userAddresses;
        } catch (error) {
            console.error("Erreur récupération adresses:", error.message);
            return [];
        }
    }

    createClient() {
        if (this.client) {
            try {
                this.client.removeAllListeners();
            } catch (e) {
                console.log('Nettoyage ancien client');
            }
        }

        this.client = new xrpl.Client(this.wssUrl, {
            connectionTimeout: 10000,
            maxFeeXRP: "2"
        });

        this.client.on('connected', () => {
            console.log('Connecté au XRPL');
            this.retryAttempts = 0;
        });

        this.client.on('disconnected', (code) => {
            console.log(`Déconnecté du XRPL (code: ${code})`);
            if (this.isRunning) {
                this.handleConnectionError();
            }
        });

        this.client.on('error', (error) => {
            console.error('Erreur XRPL client:', error.message);
            if (this.isRunning) {
                this.handleConnectionError();
            }
        });

        return this.client;
    }

    async startListener(db = null) {
        if (this.isRunning) {
            console.log('L\'indexeur est déjà en cours');
            return;
        }

        this.isRunning = true;
        console.log('Démarrage du listener XRPL...');

        try {
            if (db) {
                await this.loadUserAddresses(db);
            }

            this.createClient();
            await this.client.connect();

            const ledgerIndex = await this.client.getLedgerIndex();
            this.currentLedger = ledgerIndex;
            console.log(`Ledger actuel: ${ledgerIndex}`);

            await this.client.request({
                command: "subscribe",
                streams: ["ledger", "transactions"]
            });

            this.client.on("transaction", (tx) => {
                this.loadUserAddresses(db);
                this.handleTransaction(tx);
            });

            this.client.on("ledgerClosed", (ledger) => {
                this.handleLedgerClosed(ledger);
            });

            console.log('Listener XRPL démarré avec succès');
            this.retryAttempts = 0;

        } catch (error) {
            console.error('Erreur démarrage listener:', error.message);
            this.isRunning = false;
            this.handleConnectionError();
        }
    }

    async handleTransaction(tx) {
        console.log('Transaction event reçu');
        try {
            if (!tx.validated) return;

            const t = tx.transaction || tx.tx_json || tx;

            const {
                TransactionType,
                Account,
                Destination,
                hash,
                ledger_index,
                Amount,
                DeliverMax,
                Fee
            } = t;

            const from = Account;
            const to = Destination || null;
            const amount = Amount || DeliverMax || (tx.meta?.delivered_amount ?? null);

            if (this.userAddresses.length > 0) {
                const isUserInvolved =
                    this.userAddresses.includes(from) ||
                    (to && this.userAddresses.includes(to));

                if (!isUserInvolved) {
                    return;
                }
            }

            const event = {
                transactionHash: hash || tx.hash,
                ledgerIndex: ledger_index || tx.ledger_index,
                from,
                to,
                type: TransactionType,
                amount,
                fee: Fee || null,
                timestamp: new Date().toISOString(),
                raw: t,
                meta: tx.meta || t.metaData || null
            };

            const exists = this.events.some(e => e.transactionHash === event.transactionHash);
            if (!exists) {
                this.events.push(event);
                this.saveEvents();

                if (typeof this.onNewEvent === "function") {
                    this.onNewEvent(event);
                }

                console.log(`Nouvelle transaction détectée :
                    Type        : ${TransactionType}
                    De          : ${from}
                    Vers        : ${to || 'N/A'}
                    Montant     : ${amount || 'N/A'}
                    Frais       : ${Fee || 'N/A'}
                    Hash        : ${event.transactionHash}
                    Ledger      : ${event.ledgerIndex}
                    Date  : ${new Date().toLocaleString()}
                  `);
            }
        } catch (error) {
            console.error('Erreur traitement transaction:', error.message);
        }
    }

    handleLedgerClosed(ledger) {
        try {
            this.currentLedger = ledger.ledger_index;

            const ledgerData = {
                ledgerIndex: ledger.ledger_index,
                ledgerHash: ledger.ledger_hash,
                ledgerTime: ledger.ledger_time,
                txnCount: ledger.txn_count || 0,
                closeTime: new Date().toISOString()
            };

            if (typeof this.onNewLedger === "function") {
                this.onNewLedger(ledgerData);
            }

            console.log(`Ledger #${ledger.ledger_index} fermé (${ledgerData.txnCount} txs)`);
        } catch (error) {
            console.error('Erreur traitement ledger:', error.message);
        }
    }

    async stopListener() {
        console.log('Arrêt du listener XRPL...');
        this.isRunning = false;

        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.client && this.client.isConnected()) {
            try {
                this.client.removeAllListeners();
                await this.client.disconnect();
            } catch (error) {
                console.error('Erreur déconnexion:', error.message);
            }
        }

        console.log('Listener arrêté');
    }

    async handleConnectionError() {
        if (!this.isRunning) return;

        console.log(`Tentative de reconnexion ${this.retryAttempts + 1}/${this.maxRetries}`);

        if (this.retryAttempts >= this.maxRetries) {
            console.error('Nombre max de tentatives atteint');
            this.isRunning = false;
            return;
        }

        this.retryAttempts++;
        const delay = this.retryDelay * this.retryAttempts;

        console.log(`Attente de ${delay / 1000}s avant reconnexion...`);

        if (this.client) {
            try {
                await this.client.disconnect();
            } catch (e) {
                console.log('Erreur de connexion:', e);
            }
        }

        this.reconnectTimeout = setTimeout(async () => {
            try {
                this.isRunning = false;
                await this.startListener();
            } catch (error) {
                console.error('Erreur reconnexion:', error.message);
                this.handleConnectionError();
            }
        }, delay);
    }

    async healthCheck() {
        if (!this.client) {
            console.error('Client non initialisé');
            this.handleConnectionError();
            return false;
        }

        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout healthCheck')), 10000)
            );

            const ledgerPromise = this.client.getLedgerIndex();
            const ledgerIndex = await Promise.race([ledgerPromise, timeoutPromise]);

            console.log(`HealthCheck OK - Ledger: ${ledgerIndex}`);
            this.retryAttempts = 0;
            return true;
        } catch (error) {
            console.error('HealthCheck échoué:', error.message);
            this.handleConnectionError();
            return false;
        }
    }

    startHealthCheck(intervalMs = 30000) {
        console.log(`HealthCheck activé (${intervalMs / 1000}s)`);
        setTimeout(() => this.healthCheck(), 5000);

        this.healthCheckInterval = setInterval(() => {
            this.healthCheck();
        }, intervalMs);
    }

    stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            console.log('HealthCheck arrêté');
        }
    }

    getEvents(filters = {}) {
        let result = [...this.events];

        if (filters.from) {
            result = result.filter(e => e.from && e.from.toLowerCase() === filters.from.toLowerCase());
        }
        if (filters.to) {
            result = result.filter(e => e.to && e.to.toLowerCase() === filters.to.toLowerCase());
        }
        if (filters.type) {
            result = result.filter(e => e.type === filters.type);
        }
        if (filters.ledgerIndex) {
            result = result.filter(e => e.ledgerIndex === filters.ledgerIndex);
        }
        if (filters.fromLedger) {
            result = result.filter(e => e.ledgerIndex >= filters.fromLedger);
        }
        if (filters.toLedger) {
            result = result.filter(e => e.ledgerIndex <= filters.toLedger);
        }
        if (filters.transactionHash) {
            result = result.filter(e => e.transactionHash === filters.transactionHash);
        }

        return result;
    }

    getStats() {
        const types = {};
        this.events.forEach(e => {
            types[e.type] = (types[e.type] || 0) + 1;
        });

        return {
            totalEvents: this.events.length,
            isRunning: this.isRunning,
            currentLedger: this.currentLedger,
            connected: this.client ? this.client.isConnected() : false,
            uniqueSenders: new Set(this.events.map(e => e.from)).size,
            uniqueReceivers: new Set(this.events.filter(e => e.to).map(e => e.to)).size,
            transactionTypes: types,
            retryAttempts: this.retryAttempts
        };
    }
}

module.exports = XRPLIndexer;