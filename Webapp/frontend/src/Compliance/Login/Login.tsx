import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (!user.emailVerified) {
                setError("Veuillez vérifier votre email avant de vous connecter.");
                await auth.signOut();
                return;
            }

            const ref = doc(db, "users", user.uid);
            const snap = await getDoc(ref);

            if (!snap.exists()) {
                setError("Aucun profil utilisateur trouvé dans la base de données.");
                await auth.signOut();
                return;
            }

            const data = snap.data();

            if (data.blacklisted === true) {
                setError("Votre compte a été suspendu. Veuillez contacter l’administrateur.");
                await auth.signOut();
                return;
            }

            await updateDoc(ref, { emailVerified: user.emailVerified });

            navigate("/");
        } catch (err: unknown) {
            console.error(err);
            if (err instanceof Error) setError("Erreur : " + err.message);
            else setError("Erreur de connexion inattendue.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 relative">

                {/* ✅ Pop-up d’erreur */}
                {error && (
                    <div
                        role="alert"
                        className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-xl shadow-md animate-fade-in"
                    >
                        <div className="flex justify-between items-center">
                            <p className="text-sm font-medium">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="ml-3 text-red-600 hover:text-red-800 font-bold"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}

                <h1 className="text-2xl font-semibold mb-2 text-center">Se connecter</h1>
                <p className="text-sm text-gray-500 mb-6 text-center">
                    Connectez-vous pour accéder à l'application.
                </p>

                <form onSubmit={handleLogin} noValidate className="mt-4">
                    <label className="block mb-3">
                        <span className="text-sm font-medium text-gray-700">Adresse email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Email"
                            required
                        />
                    </label>

                    <label className="block mb-3">
                        <span className="text-sm font-medium text-gray-700">Mot de passe</span>
                        <div className="relative mt-1">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Mot de passe"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((s) => !s)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm px-2 py-1 rounded-md text-indigo-600 hover:text-indigo-800 focus:outline-none"
                                aria-pressed={showPassword}
                            >
                                {showPassword ? "Masquer" : "Afficher"}
                            </button>
                        </div>
                    </label>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2 font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        {loading ? (
                            <svg
                                className="animate-spin h-5 w-5"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                ></circle>
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                ></path>
                            </svg>
                        ) : (
                            "Se connecter"
                        )}
                    </button>

                    <p className="mt-4 text-sm text-center text-gray-500">
                        Pas de compte ?{" "}
                        <a href="/register" className="underline text-indigo-600">
                            Créez-en un
                        </a>
                    </p>
                </form>
            </div>

            {/* ✅ petite animation CSS */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}
