import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  FormEvent,
} from "react";

interface MintNftProps {
  account?: string;
}

interface NFTItem {
  NFTokenID: string;
  URI?: string;
  NFTokenTaxon?: number;
}

interface MintResponse {
  uuid: string;
  qr: string;
  link: string;
}

export default function MintNft({ account }: MintNftProps) {
  // --- Minimal + bulletproof account handling ---
  const [overrideMode, setOverrideMode] = useState(false);
  const [accountInput, setAccountInput] = useState("");

  // Read from localStorage at render time (no state dependency)
  const lsAccount = (typeof window !== "undefined"
    ? localStorage.getItem("xrplAccount")
    : "") || "";

  const effectiveAccount = useMemo(() => {
    if (overrideMode) return accountInput.trim();
    return (account || lsAccount || "").trim();
  }, [overrideMode, accountInput, account, lsAccount]);

  // --- NFT mint form state ---
  const [metadataUrl, setMetadataUrl] = useState("");
  const [transferable, setTransferable] = useState(true);
  const [burnable, setBurnable] = useState(false);
  const [transferFeeBps, setTransferFeeBps] = useState(0);
  const [taxon, setTaxon] = useState(0);

  const [isMinting, setIsMinting] = useState(false);
  const [uuid, setUuid] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [deeplink, setDeeplink] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [txid, setTxid] = useState<string | null>(null);
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const esRef = useRef<EventSource | null>(null);

  // Small helper to test refresh during dev
  const forceRefreshFromLocalStorage = () => {
    // toggling overrideMode off ensures we re-use effectiveAccount from ls
    setOverrideMode(false);
    // no-op set triggers re-render if you want:
    setAccountInput((v) => v);
  };

  // --- Helpers ---
  const resetUi = () => {
    setUuid(null);
    setQr(null);
    setDeeplink(null);
    setStatus("");
    setTxid(null);
    setNfts([]);
  };

  const hexToUtf8 = (hex?: string): string => {
    if (!hex) return "";
    try {
      return decodeURIComponent(hex.replace(/[0-9a-f]{2}/gi, "%$&").toLowerCase());
    } catch {
      try {
        return Buffer.from(hex as string, "hex").toString("utf8");
      } catch {
        return "";
      }
    }
  };

  const fetchNfts = async (acct: string) => {
    if (!acct) return;
    const r = await fetch(`/api/nft/list/${acct}`);
    if (!r.ok) throw new Error("Failed to fetch NFTs");
    const data = await r.json();
    setNfts(data?.account_nfts || []);
  };

  const startSse = (theUuid: string) => {
    try { esRef.current?.close(); } catch {}
    const es = new EventSource(`/api/status/${theUuid}`);
    esRef.current = es;

    es.onmessage = async (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload?.signed === false) {
          setStatus(payload?.expired ? "Request expired" : "Signature rejected");
        } else if (payload?.signed === true) {
          setStatus("Submitted to XRPL");
          setTxid(payload?.txid || null);
          await fetchNfts(payload?.account || effectiveAccount);
        }
      } catch {
        // ignore parse errors
      } finally {
        es.close();
        esRef.current = null;
        setIsMinting(false);
      }
    };

    es.onerror = () => {
      setStatus("Connection lost (SSE)");
      es.close();
      esRef.current = null;
      setIsMinting(false);
    };
  };

  const handleMint = async (e: FormEvent) => {
    e.preventDefault();
    resetUi();

    if (!effectiveAccount) {
      alert("No XRPL account found. Please connect your Xaman wallet first.");
      return;
    }
    if (!metadataUrl) {
      alert("Enter a metadata URL (ipfs://... or https://.../metadata.json).");
      return;
    }

    setIsMinting(true);
    setStatus("Creating Xaman request...");

    try {
      const r = await fetch("/api/nft/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadataUrl,
          transferable,
          burnable,
          taxon: Number(taxon) || 0,
          transferFeeBps: Number(transferFeeBps) || 0,
        }),
      });

      if (!r.ok) throw new Error((await r.json())?.error || "Mint payload failed");
      const data: MintResponse = await r.json();

      setUuid(data.uuid);
      setQr(data.qr);
      setDeeplink(data.link);
      setStatus("Scan the QR in Xaman or open the link");

      startSse(data.uuid);
    } catch (err: any) {
      setIsMinting(false);
      setStatus(err.message || "Error while creating mint request");
    }
  };

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "24px auto",
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
        Mint NFT (XRPL Testnet)
      </h2>
      <p style={{ marginTop: 8, color: "#6b7280" }}>
        This will create an <code>NFTokenMint</code> request to be signed in Xaman.
      </p>

      {/* XRPL Account */}
      <div style={{ marginTop: 12 }}>
        <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          Your XRPL Account (r...)
        </label>

        {/* Single input that reflects localStorage or override, always */}
        <input
          value={overrideMode ? accountInput : effectiveAccount}
          onChange={(e) => {
            setOverrideMode(true);
            setAccountInput(e.target.value);
          }}
          placeholder="rXXXXXXXXXXXX..."
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: effectiveAccount && !overrideMode ? "#f3f4f6" : "#fff",
          }}
          readOnly={!overrideMode && !!effectiveAccount}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          {effectiveAccount ? (
            <small style={{ color: "#6b7280" }}>
              Auto-filled from your wallet connection.
            </small>
          ) : (
            <small style={{ color: "#ef4444" }}>
              No account detected — connect your wallet first, or paste an account above.
            </small>
          )}
          <button
            type="button"
            onClick={forceRefreshFromLocalStorage}
            style={{
              marginLeft: "auto",
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
              fontSize: 12,
            }}
            title="Re-read xrplAccount from localStorage"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Mint Form */}
      <form onSubmit={handleMint} style={{ marginTop: 16 }}>
        <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          Metadata URL
        </label>
        <input
          value={metadataUrl}
          onChange={(e) => setMetadataUrl(e.target.value)}
          placeholder="ipfs://... or https://.../metadata.json"
          required
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            marginBottom: 12,
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              Taxon (collection id)
            </label>
            <input
              type="number"
              value={taxon}
              onChange={(e) => setTaxon(Number(e.target.value))}
              min={0}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #d1d5db",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
              Transfer Fee (BPS: 1% = 1000, max 50000)
            </label>
            <input
              type="number"
              value={transferFeeBps}
              onChange={(e) => setTransferFeeBps(Number(e.target.value))}
              min={0}
              max={50000}
              step={1}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #d1d5db",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={transferable}
              onChange={(e) => setTransferable(e.target.checked)}
            />
            Transferable
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={burnable}
              onChange={(e) => setBurnable(e.target.checked)}
            />
            Burnable
          </label>
        </div>

        <button
          type="submit"
          disabled={isMinting || !effectiveAccount}
          style={{
            marginTop: 16,
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid #111827",
            background: !effectiveAccount || isMinting ? "#e5e7eb" : "#111827",
            color: !effectiveAccount || isMinting ? "#111827" : "#fff",
            cursor: !effectiveAccount || isMinting ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {isMinting ? "Waiting for signature..." : "Mint NFT"}
        </button>
      </form>

      {uuid && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px dashed #d1d5db",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280" }}>Payload UUID: {uuid}</div>
          {qr && (
            <img
              src={qr}
              alt="Xaman QR"
              style={{
                width: 256,
                height: 256,
                objectFit: "contain",
                marginTop: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
            />
          )}
          {deeplink && (
            <div style={{ marginTop: 8 }}>
              <a
                href={deeplink}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#2563eb", textDecoration: "underline" }}
              >
                Open in Xaman (mobile)
              </a>
            </div>
          )}
        </div>
      )}

      {status && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: "#f9fafb",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <strong>Status:</strong> {status}
        </div>
      )}

      {txid && (
        <div style={{ marginTop: 8 }}>
          <strong>TxID:</strong> <code>{txid}</code>
        </div>
      )}

      {nfts?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Your NFTs</h3>
          <ul style={{ marginTop: 8 }}>
            {nfts.map((n) => (
              <li key={n.NFTokenID} style={{ marginBottom: 6 }}>
                <div>
                  <strong>ID:</strong> {n.NFTokenID}
                </div>
                {n.URI && (
                  <div>
                    <strong>URI:</strong> {hexToUtf8(n.URI)}
                  </div>
                )}
                {typeof n.NFTokenTaxon === "number" && (
                  <div>
                    <strong>Taxon:</strong> {n.NFTokenTaxon}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
