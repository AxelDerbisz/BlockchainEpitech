const xrpl = require('xrpl');

class Oracle {
    constructor(xrplUrl, walletSeed) {
        this.client = new xrpl.Client(xrplUrl);
        this.wallet = xrpl.Wallet.fromSeed(walletSeed);
    }

    async connect() {
        if (!this.client.isConnected()) {
            await this.client.connect();
        }
    }

    async fetchNvdaUsdPrice() {
        const response = await fetch(process.env.NVDA_API);
        const data = await response.json();

        console.log('NVDA/USD Price Data:', data);

        return data.last_price;
    }

    async fetchXrpUsdPrice() {
        const response = await fetch(process.env.XRP_API);
        const data = await response.json();

        console.log('XRP/USD Price Data:', data);

        return data.last_price;
    }

    async getPrice() {
        await this.connect();
        const response = await this.client.request({
            command: 'account_tx',
            account: this.wallet.classicAddress,
            limit: 5,
        });

        const tx = response.result.transactions.find((t) =>
            t.tx_json?.Memos?.some(
                (m) =>
                    JSON.parse(Buffer.from(m.Memo.MemoData, 'hex').toString())
                        .symbol === 'XRP/NVDA'
            )
        );

        if (!tx) return null;

        const memo = tx.tx_json.Memos[0].Memo;
        const value = JSON.parse(
            Buffer.from(memo.MemoData, 'hex').toString()
        ).price;
        const timestamp = new Date(tx.tx_json.date * 1000 + 946684800000);

        return { asset: 'XRP/NVDA', value, timestamp };
    }

    async updatePrice() {
        await this.connect();

        const NvdaUsd = await this.fetchNvdaUsdPrice();
        const XrpUsd = await this.fetchXrpUsdPrice();
        console.log(`Fetched Prices - NVDA/USD: ${NvdaUsd}, XRP/USD: ${XrpUsd}`);
        const value = (XrpUsd / NvdaUsd).toFixed(6);
        const memoData = JSON.stringify({ t: Date.now(), symbol: 'XRP/NVDA', price: value, source: 'oracle' });
        const tx = {
            TransactionType: 'AccountSet',
            Account: this.wallet.classicAddress,
            Memos: [
                {
                    Memo: {
                        MemoType: Buffer.from('oracle').toString('hex'),
                        MemoData: Buffer.from(memoData).toString('hex'),
                    },
                },
            ],
        };

        const prepared = await this.client.autofill(tx);
        const signed = this.wallet.sign(prepared);
        const result = await this.client.submitAndWait(signed.tx_blob);

        return result.result.hash;
    }

    async getProperty(address) {
        await this.connect();

        const response = await this.client.request({
            command: 'account_info',
            account: address,
        });

        return {
            property: address,
            balance: response.result.account_data.Balance,
            sequence: response.result.account_data.Sequence,
        };
    }
}

module.exports = Oracle;