import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../firebase";
import Cookies from "js-cookie";

type AuthContextType = {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;
    refreshToken: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isAdmin: false,
    refreshToken: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const refreshToken = async () => {
        if (auth.currentUser) {
            const tokenResult = await auth.currentUser.getIdTokenResult(true);
            const claims = tokenResult.claims || {};
            console.log("🔄 Refreshed token claims:", claims);
            setIsAdmin(!!claims.admin || claims.role === "admin");
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && firebaseUser.emailVerified) {
                setUser(firebaseUser);
                Cookies.set("auth", "true");

                // ✅ Force refresh token to get latest custom claims
                const tokenResult = await firebaseUser.getIdTokenResult(true);
                const claims = tokenResult.claims || {};
                console.log("👤 Logged in with claims:", claims);

                setIsAdmin(!!claims.admin || claims.role === "admin");
            } else {
                setUser(null);
                setIsAdmin(false);
                Cookies.remove("auth");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin, refreshToken }}>
            {children}
        </AuthContext.Provider>
    );
};
