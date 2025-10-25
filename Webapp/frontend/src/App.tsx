import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./Compliance/Contexts/AuthContext";
import { PublicRoute, PrivateRoute, PrivateAdminRoute } from "./Routes/Routes";
import { LoginPage } from "./Compliance/Login/Login";
import RegisterPage from "./Compliance/Register/Register";
import {AdminPage} from "./Pages/Administrative/Administrative";
import {AccountPage} from "./Pages/User/MyAccount";
import NFTCreationPage from "./Pages/User/NFTCreationPage";
import MyNfts  from "./Pages/User/MyNFTs";
import Home from "./Pages/Home";
import Fungible from "./Pages/User/Fungible";
import {Indexer} from "./Pages/Indexer";

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <PrivateRoute>
                                <Home />
                            </PrivateRoute>
                        }
                    />

                    <Route
                        path="/login"
                        element={
                            <PublicRoute>
                                <LoginPage />
                            </PublicRoute>
                        }
                    />

                    <Route
                        path="/register"
                        element={
                            <PublicRoute>
                                <RegisterPage />
                            </PublicRoute>
                        }
                    />

                    <Route
                        path="/account"
                        element={
                            <PrivateRoute>
                                <AccountPage />
                            </PrivateRoute>
                        }
                    />

                    <Route
                        path="/create-nft"
                        element={
                            <PrivateRoute>
                                <NFTCreationPage />
                            </PrivateRoute>
                        }
                    />

                    <Route
                        path="/fungible"
                        element={
                            <PrivateRoute>
                                <Fungible />
                            </PrivateRoute>
                        }
                    />

                    <Route
                        path="/my-nfts"
                        element={
                            <PrivateRoute>
                                <MyNfts />
                            </PrivateRoute>
                        }
                    />

                    <Route
                        path="/indexer"
                        element={
                            <PrivateRoute>
                                <Indexer />
                            </PrivateRoute>
                        }
                    />

                    <Route
                        path="/admin"
                        element={
                            <PrivateAdminRoute>
                                <AdminPage />
                            </PrivateAdminRoute>
                        }
                    />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
