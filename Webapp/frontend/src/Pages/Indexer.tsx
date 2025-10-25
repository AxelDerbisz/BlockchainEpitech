import React, { useEffect, useState } from "react";

type XRPLEvent = {
    transactionHash: string;
    ledgerIndex: number;
    from: string;
    to?: string;
    xrplType: string;
    tokenType?: string;
    amount?: string;
    fee?: string;
    timestamp: string;
};

type IndexerStatus = {
    status: string;
    stats: {
        totalEvents: number;
        isRunning: boolean;
        currentLedger: number;
        uniqueSenders: number;
        uniqueReceivers: number;
    };
    timestamp: string;
};

const API_BASE = process.env.REACT_APP_API_URL || "";
const WS_BASE =
  process.env.REACT_APP_WS_URL
  || (API_BASE ? API_BASE.replace(/^http/, "ws")
               : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`);

export function Indexer() {
    const [events, setEvents] = useState<XRPLEvent[]>([]);
    const [status, setStatus] = useState<IndexerStatus | null>(null);

    const timeAgo = (timestamp: string) => {
        const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
        if (diff < 60) return `${Math.floor(diff)}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        return `${Math.floor(diff / 3600)}h`;
    };

    useEffect(() => {
        const ws = new WebSocket(WS_BASE);

        ws.onopen = () => console.log("✅ Connecté au WebSocket");
        ws.onmessage = (message) => {
            const parsed = JSON.parse(message.data);
            if (parsed.type === "new_event") {
                setEvents((prev) => [parsed.data, ...prev.slice(0, 9)]);
            }
        };
        ws.onclose = () => console.log("❌ WebSocket fermé");
        return () => ws.close();
    }, []);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch("/api/status");
                const data = await res.json();
                setStatus(data);
            } catch (e) {
                console.error("Erreur fetch statut:", e);
            }
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 8000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar gauche - transactions récentes */}
            <aside className="w-1/3 bg-gray-900 text-white p-4 overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">✨ Transactions récentes</h2>
                <div className="space-y-3">
                    {events.map((e, i) => (
                        <div
                            key={i}
                            className="bg-gray-800 hover:bg-gray-700 transition-all rounded-lg p-4 border border-gray-700"
                        >
                            <p className="font-semibold text-green-400 mb-2">
                                🧾 {e.xrplType || "Transaction"} #{e.ledgerIndex}
                            </p>
                            <p>🏦 <strong>De :</strong> {e.from}</p>
                            <p>🎯 <strong>Vers :</strong> {e.to || "N/A"}</p>
                            {e.amount && <p>💰 <strong>Montant :</strong> {e.amount}</p>}
                            {e.fee && <p>💸 <strong>Frais :</strong> {e.fee}</p>}
                            <p>🔗 <strong>Hash :</strong> <span className="break-all text-xs text-gray-300">{e.transactionHash}</span></p>
                            <p>🕒 <strong>Horodatage :</strong> {new Date(e.timestamp).toLocaleString()}</p>
                            {e.tokenType && <p>🏷️ <strong>Type de token :</strong> {e.tokenType}</p>}
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Dashboard */}
            <main className="flex-1 p-8 space-y-8">
                <h1 className="text-3xl font-bold mb-6">📊 XRPL Indexer Dashboard</h1>

                {/* Statut indexeur */}
                <section className="bg-white shadow-md rounded-xl p-6 border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4">🩺 Statut de l’indexeur</h2>
                    {status ? (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <p><strong>État :</strong> {status.status === "running" ? "🟢 En cours" : "🔴 Arrêté"}</p>
                            <p><strong>Total événements :</strong> {status.stats.totalEvents}</p>
                            <p><strong>Ledger courant :</strong> #{status.stats.currentLedger}</p>
                            <p><strong>Expéditeurs uniques :</strong> {status.stats.uniqueSenders}</p>
                            <p><strong>Receveurs uniques :</strong> {status.stats.uniqueReceivers}</p>
                            <p><strong>Dernière mise à jour :</strong> {new Date(status.timestamp).toLocaleTimeString()}</p>
                        </div>
                    ) : (
                        <p>Chargement du statut...</p>
                    )}
                </section>
            </main>
        </div>
    );
}