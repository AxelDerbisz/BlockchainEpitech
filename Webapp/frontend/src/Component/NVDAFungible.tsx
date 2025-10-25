import React, { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";

/** ================== Types ================== */
type XummPayload = {
  uuid?: string;
  refs?: { qr_png?: string };
  next?: { always?: string };
  qr?: string;
  link?: string;
};

/** ================== UI Helpers (no new deps) ================== */
function Card(props: React.PropsWithChildren<{ title?: string; subtitle?: string; right?: React.ReactNode; className?: string }>) {
  return (
    <section
      className={
        "rounded-3xl border border-zinc-200 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.02)] " +
        "p-5 md:p-6 " +
        (props.className ?? "")
      }
    >
      {(props.title || props.subtitle || props.right) && (
        <header className="mb-4 flex items-baseline gap-2 justify-between">
          <div>
            {props.title && <h3 className="text-[15px] md:text-base font-semibold tracking-tight text-zinc-900">{props.title}</h3>}
            {props.subtitle && <p className="text-xs md:text-sm text-zinc-500">{props.subtitle}</p>}
          </div>
          {props.right}
        </header>
      )}
      {props.children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-zinc-600">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={
        "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 " +
        "outline-none transition focus:ring-4 focus:ring-blue-100 focus:border-blue-500 " +
        "placeholder:text-zinc-400 " +
        (className ?? "")
      }
    />
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "neutral" | "danger" | "ghost"; size?: "md" | "sm" };
function Button({ variant = "primary", size = "md", className, ...rest }: BtnProps) {
  const base =
    "inline-flex items-center justify-center rounded-xl text-sm font-medium transition " +
    "active:translate-y-[0.5px] disabled:opacity-50 disabled:pointer-events-none";
  const sizes = size === "sm" ? "h-9 px-3" : "h-10 px-4";
  const variants =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-4 focus-visible:ring-red-200"
      : variant === "ghost"
      ? "bg-transparent text-zinc-700 hover:bg-zinc-100"
      : "bg-zinc-900 text-white hover:bg-zinc-800";
  return <button {...rest} className={[base, sizes, variants, className].filter(Boolean).join(" ")} />;
}

function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "good" | "bad" }) {
  const map =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : tone === "bad"
      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      : "bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${map}`}>{children}</span>;
}

function Divider() {
  return <div className="my-4 h-px bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />;
}

/** ================== Main ================== */
const NVDAFungible: React.FC = () => {
  // ---------- STATE ----------
  const [balance, setBalance] = useState<string>("0");
  const [trustPayload, setTrustPayload] = useState<XummPayload | null>(null);
  const [mintPayload, setMintPayload] = useState<XummPayload | null>(null);
  const [issueAmount, setIssueAmount] = useState<string>("10");
  const [status, setStatus] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userWallet, setUserWallet] = useState<string | null>(null);

  // Manual override UX (unchanged logic)
  const [overrideMode, setOverrideMode] = useState(false);
  const [addressInput, setAddressInput] = useState("");

  const effectiveAddress = useMemo(() => {
    if (overrideMode) return addressInput.trim();
    return (userWallet || "").trim();
  }, [overrideMode, addressInput, userWallet]);

  const refreshWalletFromLocalStorage = () => {
    const stored = localStorage.getItem("xrplAccount") || "";
    if (!overrideMode) setAddressInput("");
    setUserWallet(stored || null);
  };

  // ---------- LOAD USER WALLET ----------
  useEffect(() => {
    const stored = localStorage.getItem("xrplAccount");
    if (stored) setUserWallet(stored);
    const handleWalletUpdate = (e: any) => setUserWallet(e.detail);
    window.addEventListener("xrplAccountUpdated", handleWalletUpdate);
    return () => window.removeEventListener("xrplAccountUpdated", handleWalletUpdate);
  }, []);

  // ---------- ADMIN DETECTION ----------
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;
        const tokenResult = await user.getIdTokenResult();
        if (tokenResult.claims.role === "admin") setIsAdmin(true);
      } catch (err) {
        console.error("Error checking admin role:", err);
      }
    };
    checkAdmin();
  }, []);

  // ---------- TRUSTLINE ----------
  const createTrustline = async () => {
    try {
      if (!effectiveAddress) {
        setStatus("Connect your Xaman wallet or enter an XRPL address first.");
        return;
      }
      const res = await fetch("http://localhost:4001/api/mpt/trustline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: effectiveAddress }),
      });
      const payload = await res.json();
      setTrustPayload(payload);
      setStatus("Trustline payload created. Scan or open in Xaman.");
      const link = payload?.link || payload?.next?.always;
      if (link) window.open(link, "_blank");
    } catch (err) {
      console.error(err);
      setStatus("❌ Failed to create trustline payload.");
    }
  };

  // ---------- BALANCE ----------
  const refreshBalance = async () => {
    if (!effectiveAddress) {
      setStatus("Connect your Xaman wallet or enter an XRPL address first.");
      return;
    }
    try {
      const res = await fetch(`http://localhost:4001/api/mpt/balance/${effectiveAddress}`);
      const data = await res.json();
      setBalance(data.balance ?? "0");
      setStatus("Balance updated.");
    } catch (err) {
      console.error(err);
      setStatus("❌ Failed to fetch balance.");
    }
  };

  // ---------- MINT (ADMIN) ----------
  const requestMint = async () => {
    if (!effectiveAddress) {
      setStatus("Connect wallet or enter destination XRPL address.");
      return;
    }
    setStatus("Minting NVDA...");
    setMintPayload(null);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setStatus("You must be logged in as admin.");
        return;
      }
      const token = await user.getIdToken();

      const res = await fetch("http://localhost:4001/api/mpt/issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ destination: effectiveAddress, amount: issueAmount }),
      });

      const data = await res.json();
      if (res.ok) {
        setMintPayload(data);
        setStatus("Mint payload created. Scan or open in Xaman.");
        const link = data.link || data.next?.always;
        if (link) window.open(link, "_blank");
      } else {
        setStatus(`❌ Error: ${data.error || "Mint failed."}`);
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Mint failed (auth/network error).");
    }
  };

  /** ================== RENDER ================== */
  return (
    <div className="min-h-screen bg-[#f7f7f9]">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-xl bg-zinc-900" />
            <span className="text-sm font-semibold tracking-tight text-zinc-900">NVDA on XRPL</span>
          </div>
          <div className="text-xs text-zinc-500">{status ? <Pill tone={status.startsWith("❌") ? "bad" : "muted"}>{status}</Pill> : null}</div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">Fungible Token – NVDA</h1>
          <p className="text-sm text-zinc-500">Trade NVDA on XRPL Testnet. Connect Xaman to get started.</p>
        </div>

        {/* Wallet + Balance */}
        <Card title="Wallet" subtitle={effectiveAddress ? "Auto-filled from your Xaman wallet connection" : "No wallet detected — connect or paste an address."}
              right={balance ? <Pill>Balance: <span className="ml-1 font-semibold">{balance}</span></Pill> : null}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            {!overrideMode && effectiveAddress ? (
              <>
                <div className="flex items-center gap-2">
                  <Input readOnly value={effectiveAddress} className="bg-zinc-50" />
                </div>
                <Button variant="ghost" onClick={() => { setOverrideMode(true); setAddressInput(effectiveAddress); }}>Change</Button>
                <Button variant="ghost" onClick={refreshWalletFromLocalStorage}>Refresh</Button>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>XRPL Address</Label>
                  <Input placeholder="rXXXXXXXXXXXX..." value={addressInput} onChange={(e) => setAddressInput(e.target.value)} />
                </div>
                <div className="md:col-span-2 flex items-end gap-2">
                  <Button variant="ghost" onClick={() => setOverrideMode(false)}>Use Wallet</Button>
                </div>
              </>
            )}
          </div>

          <Divider />

          <div className="flex flex-wrap gap-2">
            <Button onClick={createTrustline}>Create Trustline</Button>
            <Button variant="neutral" onClick={refreshBalance}>Refresh Balance</Button>
          </div>
        </Card>

        {/* Admin */}
        <Card
          title="Admin · Mint NVDA"
          subtitle={isAdmin ? "Mints to the address above" : "Minting restricted to admin users"}
          className={isAdmin ? "" : "opacity-70"}
          right={effectiveAddress && isAdmin ? <span className="hidden md:block text-xs text-zinc-500">Destination: <span className="font-mono text-zinc-700">{effectiveAddress}</span></span> : null}
        >
          {isAdmin ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label>Amount</Label>
                <Input value={issueAmount} onChange={(e) => setIssueAmount(e.target.value)} className="w-36" />
              </div>
              <Button onClick={requestMint} variant="primary">Mint NVDA</Button>
              <span className="text-xs text-zinc-500 md:hidden">
                {effectiveAddress ? <>Destination: <span className="font-mono">{effectiveAddress}</span></> : null}
              </span>
            </div>
          ) : (
            <p className="text-sm italic text-zinc-500">(Sign in as an admin to mint)</p>
          )}
        </Card>

        {/* Oracle + AMM */}
        <div className="grid gap-6 md:grid-cols-2">
          <OracleWidget />
          <AMMDeposit userWallet={userWallet} />
        </div>

        <AMMSwapAndWithdraw userWallet={userWallet} />

        {/* Payloads */}
        {trustPayload && <PayloadDisplay payload={trustPayload} title="Trustline Payload" />}
        {mintPayload && <PayloadDisplay payload={mintPayload} title="Mint Payload" />}
      </main>
    </div>
  );
};

export default NVDAFungible;

/** ================== Subcomponents (logic unchanged) ================== */

function PayloadDisplay({ payload, title }: { payload: any; title: string }) {
  return (
    <Card title={title} className="bg-zinc-50 border-zinc-200">
      {payload.qr || payload.refs?.qr_png ? (
        <div className="flex flex-col items-center gap-3">
          <img
            src={payload.qr || payload.refs.qr_png}
            alt="QR"
            className="h-60 w-60 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm"
          />
          <a
            href={payload.link || payload.next?.always}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-700 hover:underline"
          >
            Open in Xaman
          </a>
        </div>
      ) : (
        <pre className="max-h-64 overflow-auto rounded-2xl bg-zinc-900/95 p-4 text-xs text-emerald-300 shadow-inner">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </Card>
  );
}

type LatestResponse = {
  symbol: string;        // e.g. "XRP/NVDA"
  price: number | string; // backend may send string; we coerce to number for display
  updatedAt: string;     // ISO string or date-like
};

function OracleWidget() {
  const [price, setPrice] = useState<LatestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:4001/api/latest")
      .then(async (r) => {
        if (!r.ok) {
          let msg = `Request failed (${r.status})`;
          try {
            const body = await r.json();
            if (body?.error) msg = body.error;
          } catch {}
          throw new Error(msg);
        }
        return r.json();
      })
      .then((data: LatestResponse) => {
        setPrice(data);
        setError(null);
      })
      .catch((e) => setError(e.message || "Unable to fetch oracle data"))
      .finally(() => setLoading(false));
  }, []);

  const lastUpdated =
    price?.updatedAt ? new Date(price.updatedAt).toLocaleString() : undefined;

  const numericPrice =
    price?.price !== undefined && price?.price !== null
      ? Number(price.price)
      : NaN;

  return (
    <Card
      title={`Oracle: ${price?.symbol ?? "XRP/NVDA"}`}
      subtitle={lastUpdated ? `at ${lastUpdated}` : undefined}
    >
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : Number.isFinite(numericPrice) ? (
        <div className="text-3xl font-semibold text-zinc-900">
          {numericPrice.toFixed(6)}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No oracle data yet.</p>
      )}
    </Card>
  );
}

function AMMDeposit({ userWallet }: { userWallet: string | null }) {
  const [xrp, setXrp] = useState("100000");
  const [nvda, setNvda] = useState("10");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const [payload, setPayload] = useState<any>(null);

  const deposit = async () => {
    if (!userWallet) {
      alert("Connect your Xaman wallet first.");
      return;
    }

    setStatus("Submitting liquidity deposit...");
    setTxHash(null);
    setPoolInfo(null);
    setPayload(null);

    try {
      const res = await fetch("http://localhost:4001/api/amm/deposit/payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: userWallet,
          xrpAmountDrops: xrp,
          nvdaValue: nvda,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setStatus(`❌ ${data.error}`);
      } else if (data.hash) {
        setTxHash(data.hash);
        setStatus("Deposit successful! Liquidity added to pool.");
      } else if (data.uuid || data.refs?.qr_png) {
        setPayload(data);
        setStatus("Xumm payload created. Scan the QR code or open in Xumm.");
      } else {
        setStatus("Unexpected response from backend.");
      }

      try {
        const ammRes = await fetch("http://localhost:4001/api/amm/info");
        if (ammRes.ok) {
          const ammData = await ammRes.json();
          setPoolInfo(ammData);
        }
      } catch {
        /* ignore */
      }
    } catch (err: any) {
      console.error(err);
      setStatus(`Network or backend error: ${err.message}`);
    }
  };

  return (
    <Card title="Provide Liquidity" subtitle="Operator Direct / User Xumm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>XRP (drops)</Label>
          <Input value={xrp} onChange={(e) => setXrp(e.target.value)} className="w-44" />
        </div>
        <div className="space-y-1">
          <Label>NVDA</Label>
          <Input value={nvda} onChange={(e) => setNvda(e.target.value)} className="w-44" />
        </div>
        <Button onClick={deposit}>Deposit</Button>
      </div>

      {status && (
        <div className="mt-3">
          <Pill tone={status.startsWith("❌") ? "bad" : status.startsWith("⏳") ? "muted" : "good"}>{status}</Pill>
        </div>
      )}

      {txHash && (
        <div className="mt-3 text-sm">
          TX:&nbsp;
          <a
            href={`https://testnet.xrpl.org/transactions/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-700 hover:underline"
          >
            {txHash}
          </a>
        </div>
      )}

      {payload && (payload.qr || payload.refs?.qr_png) && (
        <div className="mt-4 text-center">
          <img
            src={payload.qr || payload.refs.qr_png}
            alt="Xumm QR"
            className="mx-auto h-56 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm"
          />
          <a
            href={payload.link || payload.next?.always}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-sm font-medium text-blue-700 hover:underline"
          >
            Open in Xumm
          </a>
        </div>
      )}

      {poolInfo && (
        <div className="mt-4">
          <pre className="max-h-64 overflow-auto rounded-2xl bg-zinc-900/95 p-4 text-xs text-emerald-300 shadow-inner">
            {JSON.stringify(poolInfo, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}

function AMMSwapAndWithdraw({ userWallet }: { userWallet: string | null }) {
  const [swapAmount, setSwapAmount] = useState("1000000");
  const [withdrawLP, setWithdrawLP] = useState("1000000");
  const [payload, setPayload] = useState<any>(null);
  const [status, setStatus] = useState("");

  const swap = async () => {
    if (!userWallet) return setStatus("Connect wallet first.");
    const res = await fetch("http://localhost:4001/api/amm/swap/payload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAddress: userWallet, fromCurrency: "XRP", toCurrency: "NVDA", fromAmount: swapAmount }),
    });
    const data = await res.json();
    setPayload(data);
    setStatus("Swap payload created.");
  };

  const withdraw = async () => {
    if (!userWallet) return setStatus("Connect wallet first.");
    const res = await fetch("http://localhost:4001/api/amm/withdraw/payload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAddress: userWallet, amount: withdrawLP }),
    });
    const data = await res.json();
    setPayload(data);
    setStatus("Withdraw payload created.");
  };

  return (
    <Card title="Swap & Withdraw">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Spend XRP (drops)</Label>
          <Input value={swapAmount} onChange={(e) => setSwapAmount(e.target.value)} className="w-44" />
        </div>
        <Button onClick={swap}>Swap XRP → NVDA</Button>
      </div>

      <Divider />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>LP Amount</Label>
          <Input value={withdrawLP} onChange={(e) => setWithdrawLP(e.target.value)} className="w-44" />
        </div>
        <Button variant="danger" onClick={withdraw}>Withdraw</Button>
      </div>

      {status && <p className="mt-3 text-sm text-zinc-500">{status}</p>}

      {payload?.refs?.qr_png && (
        <div className="mt-4 text-center">
          <img src={payload.refs.qr_png} alt="QR" className="mx-auto h-56 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm" />
          <a href={payload.next?.always} target="_blank" rel="noreferrer" className="mt-2 block text-sm font-medium text-blue-700 hover:underline">
            Open in Xaman
          </a>
        </div>
      )}
    </Card>
  );
}
