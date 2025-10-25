import 'dotenv/config'
import xrpl from 'xrpl'

const { ORACLE_SEED, XRPL_WSS } = process.env

async function main() {
  const client = new xrpl.Client(XRPL_WSS || "wss://s.altnet.rippletest.net:51233")
  await client.connect()

  const wallet = xrpl.Wallet.fromSeed(ORACLE_SEED)
  console.log('✅ Wallet loaded:', wallet.classicAddress)

  const priceData = {
    symbol: "NVDA/USD",
    priceUsd: 128.45 + Math.random(),
    timestamp: Date.now(),
    nonce: Math.random().toString(36).slice(2)
  }

  const memoHex = xrpl.convertStringToHex(JSON.stringify(priceData))
  const tx = {
    TransactionType: "AccountSet",
    Account: wallet.classicAddress,
    Fee: "12",
    Memos: [{ Memo: { MemoType: xrpl.convertStringToHex("oracle"), MemoData: memoHex } }]
  }

  try {
    console.log('📤 Submitting oracle update...')
    const prepared = await client.autofill(tx)
    const signed = wallet.sign(prepared)
    const result = await client.submitAndWait(signed.tx_blob)
    console.log('✅ Oracle price published:', {
      hash: result.result.hash,
      result: result.result.meta?.TransactionResult
    })
  } catch (err) {
    console.error('❌ Failed to publish oracle price:', err)
  } finally {
    await client.disconnect()
  }
}

main()
