import React, { useState, useEffect } from "react";

interface Offer {
  amount: string;
  owner: string;
  nft_offer_index: string;
}

export default function NFTTrading({ nftId }: { nftId: string }) {
  const [offers, setOffers] = useState<{ sell: Offer[]; buy: Offer[] }>({ sell: [], buy: [] });
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState("");

  const loadOffers = async () => {
    const res = await fetch(`/api/nft/offers/${nftId}`);
    const data = await res.json();
    setOffers(data);
  };

  useEffect(() => {
    loadOffers();
  }, [nftId]);

  const createOffer = async (type: "sell" | "buy") => {
    if (!price) return alert("Enter a price (in XRP)");
    const drops = String(Number(price) * 1_000_000);

    const res = await fetch(`/api/nft/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nftId, amountDrops: drops }),
    });
    const data = await res.json();
    setStatus(`Open Xaman or scan QR to sign your ${type} offer`);
    window.open(data.link, "_blank");
  };

  const acceptOffer = async (offerId: string) => {
    const res = await fetch(`/api/nft/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId }),
    });
    const data = await res.json();
    setStatus("Open Xaman to accept the offer");
    window.open(data.link, "_blank");
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="font-semibold mb-3">Trade NFT</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          placeholder="Price in XRP"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <button
          onClick={() => createOffer("sell")}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          List for Sale
        </button>
        <button
          onClick={() => createOffer("buy")}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          Place Bid
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-2">{status}</p>

      <h3 className="font-semibold mt-4 mb-2">Sell Offers</h3>
      {offers.sell.length === 0 && <p className="text-gray-400 text-sm">No sell offers</p>}
      {offers.sell.map((o) => (
        <div key={o.nft_offer_index} className="flex justify-between items-center border-b py-1">
          <span>{Number(o.amount) / 1_000_000} XRP by {o.owner}</span>
          <button
            onClick={() => acceptOffer(o.nft_offer_index)}
            className="text-blue-600 hover:underline text-sm"
          >
            Buy
          </button>
        </div>
      ))}

      <h3 className="font-semibold mt-4 mb-2">Buy Offers</h3>
      {offers.buy.length === 0 && <p className="text-gray-400 text-sm">No buy offers</p>}
      {offers.buy.map((o) => (
        <div key={o.nft_offer_index} className="flex justify-between items-center border-b py-1">
          <span>{Number(o.amount) / 1_000_000} XRP by {o.owner}</span>
          <button
            onClick={() => acceptOffer(o.nft_offer_index)}
            className="text-green-600 hover:underline text-sm"
          >
            Sell
          </button>
        </div>
      ))}
    </div>
  );
}