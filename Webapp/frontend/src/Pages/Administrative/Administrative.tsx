import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useAuth } from "../../Compliance/Contexts/AuthContext";

interface User {
    id: string;
    email: string;
    isAdmin: boolean;
    blacklisted: boolean;
    emailVerified: boolean;
}

export function AdminPage() {
    const actualUser = useAuth();
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
            const data = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as User[];
            setUsers(data);
        });
        return () => unsub();
    }, []);

    async function toggleBlacklist(userId: string, currentStatus: boolean) {
        await updateDoc(doc(db, "users", userId), {
            blacklisted: !currentStatus,
        });
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-1/4 bg-gray-900 text-white p-6 border-r border-gray-800">
                <h2 className="text-xl font-semibold mb-6">
                    Panneau d’administration
                </h2>

                <div className="mb-6">
                    <p className="text-gray-400 text-sm">Connecté en tant que :</p>
                    <p className="text-white font-medium">
                        {actualUser.user?.email ?? "Utilisateur inconnu"}
                    </p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4 text-sm border border-gray-700 space-y-2">
                    <p>
                        <span className="text-gray-400">Utilisateurs :</span>{" "}
                        <span className="font-medium text-white">{users.length}</span>
                    </p>
                    <p>
                        <span className="text-gray-400">Blacklistés :</span>{" "}
                        <span className="font-medium text-white">
                            {users.filter((u) => u.blacklisted).length}
                        </span>
                    </p>
                    <p>
                        <span className="text-gray-400">Admins :</span>{" "}
                        <span className="font-medium text-white">
                            {users.filter((u) => u.isAdmin).length}
                        </span>
                    </p>
                    <p>
                        <span className="text-gray-400">Emails vérifiés :</span>{" "}
                        <span className="font-medium text-white">
                            {users.filter((u) => u.emailVerified).length}
                        </span>
                    </p>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 p-10 space-y-8">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-800 mb-2">
                        Gestion des utilisateurs
                    </h1>
                    <p className="text-gray-500 text-sm">
                        Consultez et gérez les statuts des utilisateurs de la plateforme.
                    </p>
                </div>

                <section className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700 mb-4">
                        Liste des utilisateurs
                    </h2>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                            <tr className="bg-gray-100 text-left text-gray-700">
                                <th className="p-3 font-medium">Email</th>
                                <th className="p-3 text-center font-medium">
                                    Email vérifié
                                </th>
                                <th className="p-3 text-center font-medium">Admin</th>
                                <th className="p-3 text-center font-medium">Blacklisté</th>
                                <th className="p-3 text-center font-medium">Action</th>
                            </tr>
                            </thead>
                            <tbody>
                            {users.map((user) => (
                                <tr
                                    key={user.id}
                                    className="border-t hover:bg-gray-50 transition"
                                >
                                    <td className="p-3 text-gray-800">{user.email}</td>
                                    <td className="p-3 text-center">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    user.emailVerified
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-red-100 text-red-700"
                                                }`}
                                            >
                                                {user.emailVerified ? "Oui" : "Non"}
                                            </span>
                                    </td>
                                    <td className="p-3 text-center">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    user.isAdmin
                                                        ? "bg-blue-100 text-blue-700"
                                                        : "bg-gray-100 text-gray-600"
                                                }`}
                                            >
                                                {user.isAdmin ? "Oui" : "Non"}
                                            </span>
                                    </td>
                                    <td className="p-3 text-center">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    user.blacklisted
                                                        ? "bg-red-100 text-red-700"
                                                        : "bg-green-100 text-green-700"
                                                }`}
                                            >
                                                {user.blacklisted ? "Oui" : "Non"}
                                            </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() =>
                                                toggleBlacklist(
                                                    user.id,
                                                    user.blacklisted
                                                )
                                            }
                                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                                                user.blacklisted
                                                    ? "bg-green-600 hover:bg-green-500 text-white"
                                                    : "bg-red-600 hover:bg-red-500 text-white"
                                            }`}
                                        >
                                            {user.blacklisted
                                                ? "Retirer de la liste"
                                                : "Blacklister"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}
