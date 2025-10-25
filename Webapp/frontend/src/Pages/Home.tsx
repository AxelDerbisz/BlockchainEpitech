import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../Compliance/Contexts/AuthContext";

interface Listing {
  nftId: string;
  seller: string;
  price: number;
  uri?: string;
  createdAt?: number;
  active?: boolean;
}

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
}

const API_BASE = "http://localhost:4001";

export default function Home() {
  const { user } = useAuth();
  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "utilisateur";
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [metadata, setMetadata] = useState<Record<string, NFTMetadata>>({});
  const [loading, setLoading] = useState(true);

  // === Buy state ===
  const [buying, setBuying] = useState<string | null>(null);
  const [buyQr, setBuyQr] = useState<string | null>(null);
  const [buyLink, setBuyLink] = useState<string | null>(null);
  const [buyStatus, setBuyStatus] = useState<string>("");

  // === Helpers ===
  const toGatewayUrl = (uri: string) =>
    uri.startsWith("ipfs://")
      ? uri.replace("ipfs://", "https://ipfs.io/ipfs/")
      : uri;

  // === Fetch marketplace listings ===
  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/marketplace/list`);
        const data = await res.json();
        setListings(data || []);
      } catch (err) {
        console.error("❌ Failed to load listings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, []);

  // === Fetch metadata from IPFS ===
  useEffect(() => {
    listings.forEach(async (nft) => {
      if (!nft.uri || metadata[nft.nftId]) return;
      try {
        const res = await fetch(toGatewayUrl(nft.uri));
        if (!res.ok) return;
        const meta = await res.json();
        setMetadata((prev) => ({ ...prev, [nft.nftId]: meta }));
      } catch (err) {
        console.warn("⚠️ Failed to fetch metadata:", nft.uri);
      }
    });
  }, [listings]);

  // === Search filter ===
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter(
      (l) =>
        l.nftId.toLowerCase().includes(q) ||
        l.seller.toLowerCase().includes(q) ||
        (l.uri && l.uri.toLowerCase().includes(q))
    );
  }, [query, listings]);

  // === Handle Buy NFT ===
  const handleBuy = async (nftId: string) => {
    const buyer = localStorage.getItem("xrplAccount");
    if (!buyer) return alert("⚠️ Please connect your Xaman wallet first.");

    try {
      setBuying(nftId);
      setBuyStatus("Creating buy request...");
      setBuyQr(null);
      setBuyLink(null);

      const res = await fetch(`${API_BASE}/api/marketplace/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer, nftId }),
      });

      if (!res.ok) throw new Error("Failed to create buy payload");
      const data = await res.json();

      setBuyQr(data.qr);
      setBuyLink(data.link);
      setBuyStatus("Scan the QR code in Xaman or open the link");
    } catch (err: any) {
      console.error(err);
      setBuyStatus(err.message || "Error creating buy request");
    }
  };

  // === UI ===
  return (
    <div className="min-h-screen bg-gray-50">
      {/* === NAVBAR === */}
      <nav className="bg-white border-b">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="text-sm text-gray-500">Bonjour {displayName}</div>

            {/* === Search Bar === */}
            <div className="flex-1 px-4">
              <div className="max-w-xl mx-auto">
                <input
                  id="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher par vendeur, ID ou URI..."
                  className="w-full rounded-full border px-4 py-2 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* === Buttons === */}

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/create-nft")}
                className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition"
              >
                ➕ NFT
              </button>

              <button
                onClick={() => navigate("/my-nfts")}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 transition"
              >
                🖼️ Mes NFTs
              </button>

              {/* NEW: navigate to /fungible */}
              <button
                onClick={() => navigate("/fungible")}
                className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 transition"
              >
                🪙 Fungible
              </button>

              <Link
                to="/account"
                className="inline-flex items-center gap-2 rounded-full bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 transition"
              >
                Mon compte
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* === MAIN CONTENT === */}
      <main className="py-8 px-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            🎨 Marketplace — NFTs en vente
          </h2>
          <span className="text-sm text-gray-500">
            {loading
              ? "Chargement..."
              : `${filtered.length} ${filtered.length > 1 ? "listings" : "listing"
              }`}
          </span>
        </div>

        {loading ? (
          <div className="text-gray-500 text-center mt-10">
            Chargement des NFTs...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-500 text-center mt-10">
            Aucun NFT listé pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map((nft) => {
              const meta = metadata[nft.nftId];
              const img = meta?.image ? toGatewayUrl(meta.image) : undefined;

              return (
                <div
                  key={nft.nftId}
                  className="bg-white p-4 rounded-lg shadow hover:shadow-md transition"
                >
                  {img ? (
                    <img
                      src={img}
                      alt={meta?.name || "NFT"}
                      className="w-full h-48 object-cover rounded-md mb-3"
                    />
                  ) : (
                    <div className="h-48 bg-gray-100 flex items-center justify-center rounded-md text-gray-400 mb-3">
                      No Image
                    </div>
                  )}

                  <h3 className="text-sm font-semibold text-gray-800 mb-1">
                    {meta?.name || "Unnamed NFT"}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                    {meta?.description || "Aucune description."}
                  </p>
                  <p className="text-sm text-gray-700 font-mono break-all mb-2">
                    <strong>ID:</strong> {nft.nftId.slice(0, 10)}...
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>Vendeur:</strong> {nft.seller}
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    <strong>Prix:</strong> {nft.price} XRP
                  </p>

                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => handleBuy(nft.nftId)}
                      className="text-sm px-3 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      🛒 Buy
                    </button>

                    <button
                      onClick={() => navigate(`/nft/${nft.nftId}`)}
                      className="text-sm px-3 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                    >
                      Voir NFT
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* === Buy Progress === */}
        {buying && (
          <div className="mt-10 border border-dashed border-gray-300 rounded p-6 text-center bg-white">
            <h3 className="font-semibold mb-2">Buying NFT...</h3>
            {buyQr && (
              <img
                src={buyQr}
                alt="Xaman QR"
                className="w-48 h-48 mx-auto border rounded mb-2"
              />
            )}
            {buyLink && (
              <a
                href={buyLink}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 underline"
              >
                Open in Xaman (mobile)
              </a>
            )}
            <p className="text-gray-600 mt-2">{buyStatus}</p>
          </div>
        )}
      </main>
    </div>
  );
}
