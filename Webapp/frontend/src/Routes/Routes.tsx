import React, { JSX, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../Compliance/Contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

type Props = {
    children: JSX.Element;
};

export const PrivateRoute = ({ children }: Props) => {
    const { user, loading } = useAuth();
    const [allowed, setAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        const checkUserStatus = async () => {
            if (!user) {
                setAllowed(false);
                return;
            }

            try {
                const ref = doc(db, "users", user.uid);
                const snap = await getDoc(ref);

                if (snap.exists()) {
                    const data = snap.data();
                    setAllowed(data.blacklisted === false);
                } else {
                    setAllowed(false);
                }
            } catch (error) {
                console.error("Erreur Firestore (PrivateRoute):", error);
                setAllowed(false);
            }
        };

        if (!loading) checkUserStatus();
    }, [user, loading]);

    if (loading || allowed === null) {
        return <div>Chargement...</div>;
    }

    if (!user || !allowed) {
        return <Navigate to="/login" />;
    }

    return children;
};

export const PrivateAdminRoute = ({ children }: Props) => {
    const { user, loading } = useAuth();
    const [allowed, setAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAdmin = async () => {
            if (!user) {
                setAllowed(false);
                return;
            }

            try {
                const ref = doc(db, "users", user.uid);
                const snap = await getDoc(ref);

                if (snap.exists()) {
                    const data = snap.data();
                    // doit être admin ET non blacklisté
                    setAllowed(data.isAdmin === true && data.blacklisted === false);
                } else {
                    setAllowed(false);
                }
            } catch (err) {
                console.error("Erreur Firestore (PrivateAdminRoute):", err);
                setAllowed(false);
            }
        };

        if (!loading) checkAdmin();
    }, [user, loading]);

    if (loading || allowed === null) {
        return <div>Chargement...</div>;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (!allowed) {
        return <Navigate to="/" />;
    }

    return children;
};

export const PublicRoute = ({ children }: Props) => {
    const { user, loading } = useAuth();

    if (loading) return <div>Chargement...</div>;

    return user ? <Navigate to="/" /> : children;
};

export default PrivateAdminRoute;
