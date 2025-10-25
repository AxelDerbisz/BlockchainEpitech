import React, { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import {
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API_URL || ""; // set in Vercel


export function AccountPage() {
  const user = auth.currentUser;
  const navigate = useNavigate();

  const [wallet, setWallet] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [qrData, setQrData] = useState<{ qr: string; link: string } | null>(
    null
  );

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setWallet(data.address || null);
        }
      } catch (err) {
        console.error("Erreur récupération utilisateur:", err);
      }
    };
    fetchUserData();
  }, [user]);

  const connectWallet = async () => {
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/connect");
      const data = await res.json();

      const qrWindow = window.open("", "_blank", "width=400,height=500");
      qrWindow?.document.write(`
<h3>Scanne ce QR code avec Xaman 📱</h3>
<img src="${data.qr}" width="300" />
<p>Ou <a href="${data.link}" target="_blank">ouvre Xaman ici</a></p>
    `);

      // Step 3: Listen for signature via SSE
      const esUrl = API ? `${API}/api/status/${data.uuid}` : `/api/status/${data.uuid}`;
      const eventSource = new EventSource(esUrl);

      eventSource.onmessage = async (event) => {
        const result = JSON.parse(event.data);

        if (result.signed) {
          qrWindow?.close();
          eventSource.close();

          if (user) {
            await updateDoc(doc(db, "users", user.uid), { address: result.account });
          }

          localStorage.setItem("xrplAccount", result.account);
          window.dispatchEvent(new CustomEvent("xrplAccountUpdated", { detail: result.account }));

          setWallet(result.account);
          setMessage("Wallet Xaman connecté ✅");
        } else {
          setMessage("Signature refusée ❌");
        }


        setLoading(false);
      };
    } catch (err) {
      console.error(err);
      setMessage("Erreur lors de la connexion du wallet Xaman.");
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), { address: null });
        localStorage.removeItem("xrplAccount");
        window.dispatchEvent(new CustomEvent("xrplAccountUpdated", { detail: null }));
        setWallet(null);
        setMessage("Wallet déconnecté et retiré de votre compte.");
      } catch (err) {
        console.error(err);
        setMessage("Erreur lors de la déconnexion du wallet.");
      }
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    if (!user || !user.email) {
      setMessage("Utilisateur non connecté.");
      setLoading(false);
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setMessage("Mot de passe mis à jour avec succès !");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/wrong-password")
        setMessage("Mot de passe actuel incorrect.");
      else setMessage("Erreur lors de la mise à jour du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Retour
        </button>
      </header>

      <main className="flex-1 grid gap-8 p-8 max-w-6xl mx-auto w-full">
        <section className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-xl font-semibold text-gray-800">Mon Compte</h1>
          <p className="text-sm text-gray-600 mb-2">Email :</p>
          <p className="font-medium mb-4">{user?.email}</p>

          <p className="text-sm text-gray-600 mb-2">Email vérifié :</p>
          {user?.emailVerified ? (
            <span className="text-green-600 font-semibold">Oui</span>
          ) : (
            <span className="text-red-600 font-semibold">Non</span>
          )}

          <div className="mt-6">
            <h3 className="text-md font-semibold mb-2">Adresse du wallet :</h3>
            {wallet ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm break-all bg-gray-100 p-2 rounded-md">
                  {wallet}
                </p>
                <button
                  onClick={disconnectWallet}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                >
                  Déconnecter le wallet
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Connecter un wallet
              </button>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">
              Sécurité
            </h2>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Mot de passe actuel"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nouveau mot de passe"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? "Mise à jour..." : "Changer le mot de passe"}
              </button>
            </form>
          </div>

          <div className="mt-8 border-t pt-6">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Se déconnecter
            </button>
          </div>

          {message && (
            <p className="mt-4 text-center text-sm text-indigo-600">{message}</p>
          )}
        </section>
      </main>
    </div>
  );
}