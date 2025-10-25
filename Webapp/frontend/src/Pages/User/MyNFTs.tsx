import React, { useEffect, useState, useRef } from "react";

interface NFTItem {
  NFTokenID: string;
  URI?: string;
  NFTokenTaxon?: number;
}

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
}

export default function MyNfts() {
  const [account, setAccount] = useState<string | null>(
    localStorage.getItem("xrplAccount")
  );
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [metadataMap, setMetadataMap] = useState<Record<string, NFTMetadata>>({});

  // === Burn State ===
  const [burnUuid, setBurnUuid] = useState<string | null>(null);
  const [burnQr, setBurnQr] = useState<string | null>(null);
  const [burnLink, setBurnLink] = useState<string | null>(null);
  const [burnStatus, setBurnStatus] = useState("");

  // === Sell State ===
  const [sellUuid, setSellUuid] = useState<string | null>(null);
  const [sellQr, setSellQr] = useState<string | null>(null);
  const [sellLink, setSellLink] = useState<string | null>(null);
  const [sellStatus, setSellStatus] = useState("");
  const [sellingId, setSellingId] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);

  // === Helpers ===
  const hexToUtf8 = (hex?: string): string => {
    if (!hex) return "";
    try {
      return decodeURIComponent(hex.replace(/[0-9a-f]{2}/gi, "%$&").toLowerCase());
    } catch {
      try {
        return Buffer.from(hex, "hex").toString("utf8");
      } catch {
        return "";
      }
    }
  };

  const toGatewayUrl = (uri: string) =>
    uri.startsWith("ipfs://") ? uri.replace("ipfs://", "https://ipfs.io/ipfs/") : uri;

  // === Fetch NFTs ===
  const fetchNfts = async (acct: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/nft/list/${acct}?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await r.json();
      setNfts(data?.account_nfts || []);
    } catch (e) {
      console.error("Error fetching NFTs:", e);
    } finally {
      setLoading(false);
    }
  };

  // === Fetch Metadata ===
  const fetchMetadata = async (uri: string, id: string) => {
    const gatewayUrl = toGatewayUrl(uri);
    try {
      const res = await fetch(gatewayUrl);
      if (!res.ok) return;
      const json = await res.json();
      setMetadataMap((prev) => ({ ...prev, [id]: json }));
    } catch (err) {
      console.warn("Failed to load metadata for", uri, err);
    }
  };

  // === Burn ===
  const handleBurn = async (nftId: string) => {
    if (!account) return alert("Connect your Xaman wallet first.");
    if (!window.confirm("Are you sure you want to burn this NFT?")) return;

    try {
      setBurnStatus("Creating burn request...");
      const r = await fetch(`/api/nft/burn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, NFTokenID: nftId }),
      });
      const data = await r.json();
      setBurnUuid(data.uuid);
      setBurnQr(data.qr);
      setBurnLink(data.link);
      setBurnStatus("Scan the QR code in Xaman or open the link");
      startBurnSse(data.uuid, nftId);
    } catch (err: any) {
      console.error(err);
      setBurnStatus("Error creating burn request");
    }
  };

  const startBurnSse = (uuid: string, burnedTokenId: string) => {
    try {
      esRef.current?.close();
    } catch {}
    const es = new EventSource("/api/status/${uuid}");
    esRef.current = es;

    let gotSigned = false;

    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload?.signed) {
          gotSigned = true;
          setBurnStatus("✅ Burn confirmed — verifying...");
          es.close();
          verifyBurn(burnedTokenId);
        } else {
          setBurnStatus("❌ Signature rejected or expired");
        }
      } catch {}
    };

    es.onerror = () => {
      console.warn("SSE closed");
      es.close();
      if (!gotSigned) verifyBurn(burnedTokenId);
    };
  };

  const verifyBurn = async (burnedTokenId: string) => {
    if (!account) return;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`/api/nft/list/${account}?t=${Date.now()}`);
      const data = await res.json();
      const stillExists = data.account_nfts?.some(
        (n: any) => n.NFTokenID === burnedTokenId
      );
      if (!stillExists) {
        await fetchNfts(account);
        setBurnStatus("🔥 NFT successfully burned!");
        setTimeout(() => {
          setBurnUuid(null);
          setBurnQr(null);
          setBurnLink(null);
          setBurnStatus("");
        }, 2500);
        return;
      }
    }
  };

  // === Sell ===
  const handleSell = async (nftId: string, uri?: string) => {
    if (!account) return alert("Connect your Xaman wallet first.");
    const price = prompt("Enter sale price (in XRP):");
    if (!price) return;

    try {
      setSellStatus("Creating sale request...");
      setSellingId(nftId);
      const r = await fetch(`/api/marketplace/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, nftId, price, uri }),
      });
      const data = await r.json();

      setSellUuid(data.uuid);
      setSellQr(data.qr);
      setSellLink(data.link);
      setSellStatus("Scan QR in Xaman to confirm sale");

      startSellSse(data.uuid, nftId);
    } catch (err) {
      console.error(err);
      setSellStatus("Error creating sale request");
    }
  };

  const startSellSse = (uuid: string, nftId: string) => {
    try {
      esRef.current?.close();
    } catch {}
    const es = new EventSource(`/api/status/${uuid}`);
    esRef.current = es;

    es.onmessage = async (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload?.signed === true) {
          setSellStatus("✅ Sell offer signed — activating...");
          await fetch(`/api/marketplace/confirm-sell`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nftId }),
          });
          setSellStatus("✅ NFT now listed on marketplace!");
          await fetchNfts(account!);
        } else {
          setSellStatus("❌ Offer rejected or expired");
        }
      } catch (err) {
        console.error("SSE error:", err);
      } finally {
        es.close();
        esRef.current = null;
        setTimeout(() => {
          setSellUuid(null);
          setSellQr(null);
          setSellLink(null);
          setSellStatus("");
          setSellingId(null);
        }, 2500);
      }
    };

    es.onerror = () => {
      console.warn("⚠️ Sell SSE connection closed");
      es.close();
    };
  };

  // === Account sync ===
  useEffect(() => {
    const updateAccount = () => {
      const acc = localStorage.getItem("xrplAccount");
      setAccount(acc);
      if (acc) fetchNfts(acc);
    };
    updateAccount();
    window.addEventListener("focus", updateAccount);
    return () => window.removeEventListener("focus", updateAccount);
  }, []);

  // === Load metadata ===
  useEffect(() => {
    nfts.forEach((nft) => {
      const uri = hexToUtf8(nft.URI);
      if (uri && !metadataMap[nft.NFTokenID]) {
        fetchMetadata(uri, nft.NFTokenID);
      }
    });
  }, [nfts]);

  if (!account)
    return (
      <div style={{ textAlign: "center", marginTop: 40 }}>
        <h2>My NFTs</h2>
        <p style={{ color: "#ef4444" }}>
          ⚠️ Please connect your Xaman wallet to view your NFTs.
        </p>
      </div>
    );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>My NFTs</h2>

      {loading && <p>Loading NFTs...</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {nfts.map((nft) => {
          const uri = hexToUtf8(nft.URI);
          const meta = metadataMap[nft.NFTokenID];
          const img = meta?.image ? toGatewayUrl(meta.image) : undefined;

          return (
            <div
              key={nft.NFTokenID}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              {img ? (
                <img
                  src={img}
                  alt={meta?.name || "NFT"}
                  style={{ width: "100%", height: 200, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    height: 200,
                    background: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#9ca3af",
                  }}
                >
                  No image
                </div>
              )}
              <div style={{ padding: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  {meta?.name || "Unnamed NFT"}
                </h3>
                <p style={{ fontSize: 12, color: "#6b7280" }}>
                  ID: {nft.NFTokenID.slice(0, 10)}... <br />
                  Taxon: {nft.NFTokenTaxon ?? 0}
                </p>

                <a
                  href={uri ? toGatewayUrl(uri) : "#"}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    color: "#2563eb",
                    fontSize: 13,
                    textDecoration: "underline",
                  }}
                >
                  View Metadata
                </a>

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => handleBurn(nft.NFTokenID)}
                    style={{
                      flex: 1,
                      background: "#ef4444",
                      color: "white",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    🔥 Burn
                  </button>
                  <button
                    onClick={() => handleSell(nft.NFTokenID, uri)}
                    style={{
                      flex: 1,
                      background: "#22c55e",
                      color: "white",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    💰 Sell
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(burnUuid || sellUuid) && (
        <div
          style={{
            marginTop: 24,
            border: "1px dashed #d1d5db",
            borderRadius: 12,
            padding: 16,
            textAlign: "center",
          }}
        >
          <h3 style={{ margin: 0 }}>
            {sellUuid ? "Sell in progress" : "Burn in progress"}
          </h3>

          {(burnQr || sellQr) && (
            <img
              src={burnQr || sellQr || ""}
              alt="Xaman QR"
              style={{
                width: 200,
                height: 200,
                marginTop: 12,
                objectFit: "contain",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
            />
          )}

          {(burnLink || sellLink) && (
            <div style={{ marginTop: 8 }}>
              <a
                href={burnLink || sellLink || "#"}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#2563eb", textDecoration: "underline" }}
              >
                Open in Xaman (mobile)
              </a>
            </div>
          )}

          <p style={{ marginTop: 8, color: "#6b7280" }}>
            {burnStatus || sellStatus}
          </p>
        </div>
      )}
    </div>
  );
}
