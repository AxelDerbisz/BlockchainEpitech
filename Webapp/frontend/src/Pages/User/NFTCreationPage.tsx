import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  FormEvent,
  ChangeEvent,
} from "react";
import { useNavigate } from "react-router-dom";

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

const API_BASE = process.env.REACT_APP_API_URL || ""; // set in Vercel to https://blockchainepitech.onrender.com
const api = (p: string) => (API_BASE ? `${API_BASE}${p}` : p);

export default function MintNft({ account }: MintNftProps) {
  const navigate = useNavigate();

  const [storedAccount, setStoredAccount] = useState<string>(
    () => localStorage.getItem("xrplAccount") ?? ""
  );

  useEffect(() => {
    const updateAccount = () => {
      const val = localStorage.getItem("xrplAccount") ?? "";
      if (val !== storedAccount) {
        setStoredAccount(val);
      }
    };

    updateAccount();
    window.addEventListener("xrplAccountUpdated", updateAccount);
    window.addEventListener("storage", updateAccount);
    window.addEventListener("focus", updateAccount);

    return () => {
      window.removeEventListener("xrplAccountUpdated", updateAccount);
      window.removeEventListener("storage", updateAccount);
      window.removeEventListener("focus", updateAccount);
    };
  }, [storedAccount]);

  const [overrideMode, setOverrideMode] = useState(false);
  const [accountInput, setAccountInput] = useState("");
  const effectiveAccount = useMemo(() => {
    if (overrideMode) return accountInput.trim();
    return (account || storedAccount || "").trim();
  }, [account, storedAccount, overrideMode, accountInput]);

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

  
  const [pinataJWT, setPinataJWT] = useState("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI2YzFmNDg5YS0zNWYyLTQwNWItOWEwMS01OTcxOGNlYTNlYzciLCJlbWFpbCI6ImF4ZWwuZGVyYmlzekBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiNzg3ZGI2ZDI2MDE0YjgxMDhlN2IiLCJzY29wZWRLZXlTZWNyZXQiOiJjODgyNDkwMTNmYjgyM2Q5NjQ0YTY3MTFiNDBiNTYwNWJkMzJjM2RhYTMyMWE5N2NmNmEyZmJkYTQ0ZmExOGMyIiwiZXhwIjoxNzkyMjMwNjI5fQ.hOpJF4V12jqQ5ds_kvhCvY-hLpe7kiYA40IHU__XFy4");
  const [nftName, setNftName] = useState("");
  const [nftDescription, setNftDescription] = useState("");
  const [nftImageFile, setNftImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [storageGB, setStorageGB] = useState<number | "">("");
  const [condition, setCondition] = useState<"New" | "Like New" | "Used" | "">("");
  const [batteryHealth, setBatteryHealth] = useState<number | "">("");
  const [warrantyDate, setWarrantyDate] = useState<string>(""); 
  const [region, setRegion] = useState("");
  const [accessories, setAccessories] = useState("");
  const [serialOrImei, setSerialOrImei] = useState(""); 
  const [hashSerial, setHashSerial] = useState(true);
  const [salt, setSalt] = useState(""); 

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setNftImageFile(file);
  };

  const toHex = (buf: ArrayBuffer) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const sha256Hex = async (text: string) => {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    return "0x" + toHex(digest);
  };

  const dateToUnix = (yyyyMmDd: string) => {
    if (!yyyyMmDd) return undefined;
    const d = new Date(yyyyMmDd + "T00:00:00Z");
    if (isNaN(d.getTime())) return undefined;
    return Math.floor(d.getTime() / 1000);
  };

  const handlePinataUpload = async () => {
    if (!pinataJWT) return alert("Enter your Pinata JWT key first.");
    if (!nftName.trim()) return alert("Enter a name for your NFT.");

    try {
      setIsUploading(true);

      let imageIpfsUrl: string | undefined;

      if (nftImageFile) {
        const imageForm = new FormData();
        imageForm.append("file", nftImageFile);

        const imgResp = await fetch(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${pinataJWT}` },
            body: imageForm,
          }
        );

        if (!imgResp.ok) throw new Error("Image upload failed");
        const imgData = await imgResp.json();
        imageIpfsUrl = `ipfs://${imgData.IpfsHash}`;
      }

      const attrs: Array<Record<string, any>> = [];
      const pushAttr = (trait_type: string, value: any, display_type?: string) => {
        if (value === "" || value === undefined || value === null) return;
        const entry: any = { trait_type, value };
        if (display_type) entry.display_type = display_type;
        attrs.push(entry);
      };

      pushAttr("Brand", brand);
      pushAttr("Model", model);
      pushAttr("Color", color);
      if (storageGB !== "") pushAttr("Storage (GB)", Number(storageGB), "number");
      pushAttr("Condition", condition || undefined);
      if (batteryHealth !== "")
        pushAttr("Battery Health (%)", Number(batteryHealth), "number");
      const warrantyUnix = dateToUnix(warrantyDate);
      if (warrantyUnix) pushAttr("Warranty Expiration", warrantyUnix, "date");
      pushAttr("Region", region);
      pushAttr("Accessories", accessories);

      if (serialOrImei.trim()) {
        const input = salt ? `${serialOrImei.trim()}::${salt}` : serialOrImei.trim();
        const serialVal = hashSerial ? await sha256Hex(input) : serialOrImei.trim();
        pushAttr(hashSerial ? "SerialHash" : "SerialOrIMEI", serialVal);
      }

      const metadata: Record<string, any> = {
        name: nftName,
        description: nftDescription,
      };

      if (imageIpfsUrl) metadata.image = imageIpfsUrl;
      if (attrs.length > 0) metadata.attributes = attrs;

      const metaResp = await fetch(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pinataJWT}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pinataContent: metadata,
            pinataMetadata: { name: `${nftName}_metadata.json` },
          }),
        }
      );

      if (!metaResp.ok) throw new Error("Metadata upload failed");
      const metaData = await metaResp.json();
      const metadataIpfsUrl = `ipfs://${metaData.IpfsHash}`;

      setMetadataUrl(metadataIpfsUrl);
      alert("✅ Metadata uploaded successfully! URL filled.");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

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
        return Buffer.from(hex, "hex").toString("utf8");
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
    try {
      esRef.current?.close();
    } catch {}
    const esUrl = API_BASE
    ? `${API_BASE}/api/status/${theUuid}`
    : `/api/status/${theUuid}`;
    const es = new EventSource(esUrl);
    esRef.current = es;

    es.onmessage = async (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload?.signed === false) {
          setStatus(payload?.expired ? "Request expired" : "Signature rejected");
        } else if (payload?.signed === true) {
          setStatus("Submitted to XRPL ✅");
          setTxid(payload?.txid || null);
          await fetchNfts(payload?.account || effectiveAccount);
        }
      } catch (err) {
        console.error("Error parsing SSE payload:", err);
      } finally {
        es.close();
        esRef.current = null;
        setIsMinting(false);
      }
    };

    es.onerror = () => {
      console.warn("SSE connection closed");
      if (!status.includes("Submitted to XRPL")) {
        setStatus("Connection lost before completion");
      }
      es.close();
      esRef.current = null;
      setIsMinting(false);
    };
  };

  const handleMint = async (e: FormEvent) => {
    e.preventDefault();
    resetUi();

    if (!effectiveAccount) {
      alert("You must connect your Xaman wallet before minting an NFT.");
      return;
    }
    if (!metadataUrl) {
      alert("Enter or upload a metadata URL first.");
      return;
    }

    setIsMinting(true);
    setStatus("Creating Xaman request...");

    try {
      const r = await fetch(`${API_BASE}/api/nft/mint`, {
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

      if (!r.ok) throw new Error("Mint payload failed");
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

  useEffect(() => {
    if (txid && nfts.length > 0 && status.includes("Connection lost")) {
      setStatus("✅ NFT Minted Successfully!");
    }
  }, [txid, nfts, status]);

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
      {/* === Header with My NFTs Button === */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          Mint NFT (XRPL Testnet)
        </h2>
        <button
          type="button"
          onClick={() => navigate("/my-nfts")}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            background: "#2563eb",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          My NFTs
        </button>
      </div>

      {/* === XRPL Account Section === */}
      <div style={{ marginTop: 12 }}>
        <label style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          Your XRPL Account (r...)
        </label>

        {!overrideMode && effectiveAccount ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={effectiveAccount}
              readOnly
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#f3f4f6",
              }}
            />
            <button
              type="button"
              onClick={() => {
                setOverrideMode(true);
                setAccountInput(effectiveAccount);
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <input
            value={accountInput}
            onChange={(e) => setAccountInput(e.target.value)}
            placeholder="rXXXXXXXXXXXX..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #d1d5db",
            }}
          />
        )}
      </div>

      {/* === Pinata Upload Section === */}
      <div
        style={{
          marginTop: 20,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#f9fafb",
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>
          Create NFT Metadata (Pinata + IPFS)
        </h3>
        <input
          type="password"
          value={pinataJWT}
          onChange={(e) => setPinataJWT(e.target.value)}
          placeholder="Pinata JWT Token"
          style={{ width: "100%", padding: 8, marginTop: 8 }}
        />
        <input
          value={nftName}
          onChange={(e) => setNftName(e.target.value)}
          placeholder="NFT Name"
          style={{ width: "100%", padding: 8, marginTop: 8 }}
        />
        <textarea
          value={nftDescription}
          onChange={(e) => setNftDescription(e.target.value)}
          placeholder="NFT Description"
          rows={3}
          style={{ width: "100%", padding: 8, marginTop: 8 }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ marginTop: 8 }}
        />
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          (Optional: You can mint an NFT without uploading an image.)
        </p>

        {/* --- Phone Metadata (optional) --- */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 12,
            background: "#fff",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <input placeholder="Brand" value={brand} onChange={(e)=>setBrand(e.target.value)} />
          <input placeholder="Model" value={model} onChange={(e)=>setModel(e.target.value)} />
          <input placeholder="Color" value={color} onChange={(e)=>setColor(e.target.value)} />
          <input
            placeholder="Storage (GB)"
            type="number"
            min={0}
            value={storageGB}
            onChange={(e)=>setStorageGB(e.target.value === "" ? "" : Number(e.target.value))}
          />
          <select value={condition} onChange={(e)=>setCondition(e.target.value as any)}>
            <option value="">Condition</option>
            <option value="New">New</option>
            <option value="Like New">Like New</option>
            <option value="Used">Used</option>
          </select>
          <input
            placeholder="Battery Health (%)"
            type="number"
            min={0}
            max={100}
            value={batteryHealth}
            onChange={(e)=>setBatteryHealth(e.target.value === "" ? "" : Number(e.target.value))}
          />
          <input
            placeholder="Warranty Expiration (YYYY-MM-DD)"
            value={warrantyDate}
            onChange={(e)=>setWarrantyDate(e.target.value)}
          />
          <input placeholder="Region (e.g., EU)" value={region} onChange={(e)=>setRegion(e.target.value)} />
          <input
            placeholder="Accessories (comma separated)"
            value={accessories}
            onChange={(e)=>setAccessories(e.target.value)}
            style={{ gridColumn: "1 / span 2" }}
          />
          <input
            placeholder="Serial or IMEI (will be hashed)"
            value={serialOrImei}
            onChange={(e)=>setSerialOrImei(e.target.value)}
            style={{ gridColumn: "1 / span 2" }}
          />
          <div style={{ gridColumn: "1 / span 2", display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={hashSerial}
                onChange={(e)=>setHashSerial(e.target.checked)}
              />
              Hash serial/IMEI before upload (recommended)
            </label>
            <input
              placeholder="Optional salt"
              value={salt}
              onChange={(e)=>setSalt(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handlePinataUpload}
          disabled={isUploading}
          style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: isUploading ? "#ccc" : "#111827",
            color: "#fff",
          }}
        >
          {isUploading ? "Uploading..." : "Upload Metadata to IPFS"}
        </button>
      </div>

      {}
      <form onSubmit={handleMint} style={{ marginTop: 16 }}>
        <input
          value={metadataUrl}
          onChange={(e) => setMetadataUrl(e.target.value)}
          placeholder="ipfs://...metadata.json"
          style={{ width: "100%", padding: 10, marginBottom: 8 }}
        />

        {}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={transferable}
              onChange={(e)=>setTransferable(e.target.checked)}
            />
            Transferable
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={burnable}
              onChange={(e)=>setBurnable(e.target.checked)}
            />
            Burnable
          </label>
          <input
            type="number"
            min={0}
            max={50000}
            value={transferFeeBps}
            onChange={(e)=>setTransferFeeBps(Number(e.target.value) || 0)}
            placeholder="Transfer Fee (bps)"
            style={{ width: 180 }}
          />
          <input
            type="number"
            min={0}
            value={taxon}
            onChange={(e)=>setTaxon(Number(e.target.value) || 0)}
            placeholder="Taxon"
            style={{ width: 120 }}
          />
        </div>

        <button
          type="submit"
          disabled={isMinting || !effectiveAccount}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: isMinting ? "#ccc" : "#111827",
            color: "#fff",
          }}
        >
          {isMinting ? "Waiting for signature..." : "Mint NFT"}
        </button>
      </form>

      {uuid && qr && (
        <div style={{ marginTop: 16 }}>
          <img src={qr} alt="QR" width={200} height={200} />
          {deeplink && (
            <div>
              <a href={deeplink} target="_blank" rel="noreferrer">
                Open in Xaman
              </a>
            </div>
          )}
        </div>
      )}

      {status && <div style={{ marginTop: 8 }}>Status: {status}</div>}

      {txid && (
        <div style={{ marginTop: 8 }}>
          TxID:{" "}
          <a
            href={`https://testnet.xrpl.org/transactions/${txid}`}
            target="_blank"
            rel="noreferrer"
          >
            {txid}
          </a>
        </div>
      )}

      {nfts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Your NFTs</h3>
          <ul>
            {nfts.map((nft) => (
              <li key={nft.NFTokenID}>
                <div>ID: {nft.NFTokenID}</div>
                <div>URI: {hexToUtf8(nft.URI)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
