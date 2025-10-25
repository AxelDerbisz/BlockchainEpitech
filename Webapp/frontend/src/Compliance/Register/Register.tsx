import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";


type FormValues = {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
};

type FormErrors = {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
};

type ApiResponse = { ok: boolean; message?: string };

function RegisterPage() {
    const [form, setForm] = useState<FormValues>({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const [errors, setErrors] = useState<FormErrors>({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [serverError, setServerError] = useState("");
    const navigate = useNavigate();

    function validate(values: FormValues): FormErrors {
        const errs: FormErrors = {
            fullName: "",
            email: "",
            password: "",
            confirmPassword: "",
        };

        if (!values.fullName.trim()) errs.fullName = "Le nom complet est requis.";

        if (!values.email.trim()) {
            errs.email = "L'email est requis.";
        } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
            errs.email = "Format d'email invalide.";
        }

        if (!values.password) {
            errs.password = "Le mot de passe est requis.";
        } else if (values.password.length < 8) {
            errs.password = "Le mot de passe doit contenir au moins 8 caractères.";
        }

        if (!values.confirmPassword) {
            errs.confirmPassword = "Veuillez confirmer le mot de passe.";
        } else if (values.password !== values.confirmPassword) {
            errs.confirmPassword = "Les mots de passe ne correspondent pas.";
        }

        return errs;
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSuccessMessage("");
        setServerError("");

        const validation = validate(form);
        setErrors(validation);

        const hasErrors = Object.values(validation).some((err) => err !== "");
        if (hasErrors) return;

        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                form.email,
                form.password
            );

            if (auth.currentUser) {
                await updateProfile(auth.currentUser, {
                    displayName: form.fullName,
                });

                await sendEmailVerification(auth.currentUser, {
                    url: "http://localhost:3000/login",
                });
            }

            if (auth.currentUser?.uid) {
                await setDoc(doc(db, "users", auth.currentUser!.uid), {
                    email: auth.currentUser?.email ?? "",
                    isAdmin: false,
                    blacklisted: false,
                    emailVerified: auth.currentUser?.emailVerified ?? false,
                });
            }

            setSuccessMessage(
                "Inscription réussie ! Vérifiez votre boîte mail et cliquez sur le lien pour activer votre compte."
            );

            setForm({ fullName: "", email: "", password: "", confirmPassword: "" });
            setErrors({ fullName: "", email: "", password: "", confirmPassword: "" });
        } catch (error: unknown) {
            if (error instanceof Error) setServerError(error.message);
            else setServerError("Une erreur est survenue");
        } finally {
            setLoading(false);
            navigate("/login");
        }
    }


    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
                <h1 className="text-2xl font-semibold mb-2">Créer un compte</h1>
                <p className="text-sm text-gray-500 mb-6">
                    Créez votre compte pour accéder à l'application.
                </p>

                {successMessage && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="mb-4 p-3 rounded-md bg-green-50 text-green-800"
                    >
                        {successMessage}
                    </div>
                )}
                {serverError && (
                    <div
                        role="alert"
                        aria-live="assertive"
                        className="mb-4 p-3 rounded-md bg-red-50 text-red-800"
                    >
                        {serverError}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700">
            Nom complet
          </span>
                        <input
                            type="text"
                            name="fullName"
                            value={form.fullName}
                            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                            className={`mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                errors.fullName ? "border-red-300" : "border-gray-200"
                            }`}
                            aria-invalid={errors.fullName ? "true" : "false"}
                            aria-describedby={errors.fullName ? "fullName-error" : undefined}
                        />
                        {errors.fullName && (
                            <p id="fullName-error" className="text-xs text-red-600 mt-1">
                                {errors.fullName}
                            </p>
                        )}
                    </label>

                    <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700">
            Adresse email
          </span>
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className={`mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                errors.email ? "border-red-300" : "border-gray-200"
                            }`}
                            aria-invalid={errors.email ? "true" : "false"}
                            aria-describedby={errors.email ? "email-error" : undefined}
                        />
                        {errors.email && (
                            <p id="email-error" className="text-xs text-red-600 mt-1">
                                {errors.email}
                            </p>
                        )}
                    </label>

                    <div className="grid grid-cols-1 gap-3 mb-3">
                        <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Mot de passe
            </span>
                            <div className="relative mt-1">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className={`block w-full rounded-lg border px-3 py-2 shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                        errors.password ? "border-red-300" : "border-gray-200"
                                    }`}
                                    aria-invalid={errors.password ? "true" : "false"}
                                    aria-describedby={errors.password ? "password-error" : undefined}
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sm px-2 py-1 rounded-md focus:outline-none"
                                    aria-pressed={showPassword}
                                >
                                    {showPassword ? "Masquer" : "Afficher"}
                                </button>
                            </div>
                            {errors.password && (
                                <p id="password-error" className="text-xs text-red-600 mt-1">
                                    {errors.password}
                                </p>
                            )}

                            <PasswordStrengthBar password={form.password} />
                        </label>

                        <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Confirmer le mot de passe
            </span>
                            <input
                                type={showPassword ? "text" : "password"}
                                name="confirmPassword"
                                value={form.confirmPassword}
                                onChange={(e) =>
                                    setForm({ ...form, confirmPassword: e.target.value })
                                }
                                className={`mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                    errors.confirmPassword ? "border-red-300" : "border-gray-200"
                                }`}
                                aria-invalid={errors.confirmPassword ? "true" : "false"}
                                aria-describedby={
                                    errors.confirmPassword ? "confirmPassword-error" : undefined
                                }
                            />
                            {errors.confirmPassword && (
                                <p
                                    id="confirmPassword-error"
                                    className="text-xs text-red-600 mt-1"
                                >
                                    {errors.confirmPassword}
                                </p>
                            )}
                        </label>
                    </div>

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
                            "S'inscrire"
                        )}
                    </button>

                    <p className="mt-4 text-sm text-center text-gray-500">
                        En vous inscrivant, vous acceptez nos{" "}
                        <a href="#" className="underline">
                            conditions d'utilisation
                        </a>
                        .
                    </p>
                </form>

                <footer className="mt-6 text-center text-sm text-gray-600">
                    Déjà un compte ?{" "}
                    <a href="/login" className="text-indigo-600 underline">
                        Connectez-vous
                    </a>
                </footer>
            </div>
        </div>
    );
}

export default RegisterPage

function PasswordStrengthBar({ password }: { password: string }) {
    const score = passwordStrength(password);
    const label = strengthLabel(score);
    const barWidth = `${(score / 3) * 100}%`;

    return (
        <div className="mt-2" aria-live="polite">
            <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                    className="h-2 rounded-full"
                    style={{
                        width: barWidth,
                        background:
                            score === 0
                                ? "#f43f5e"
                                : score === 1
                                    ? "#fb923c"
                                    : score === 2
                                        ? "#facc15"
                                        : "#10b981",
                    }}
                />
            </div>
            <p className="text-xs text-gray-500 mt-1">
                Force du mot de passe : {label}
            </p>
        </div>
    );

    function passwordStrength(pw: string) {
        let score = 0;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
        if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
        return score;
    }

    function strengthLabel(score: number) {
        switch (score) {
            case 0:
                return "Très faible";
            case 1:
                return "Faible";
            case 2:
                return "Moyen";
            case 3:
                return "Fort";
            default:
                return "";
        }
    }
}
