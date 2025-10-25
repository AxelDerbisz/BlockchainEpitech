# Plateforme de Gestion d’Actifs Tokenisés

> Une plateforme décentralisée permettant de tokeniser, gérer et échanger des actifs du monde réel (RWA) de manière sécurisée sur le XRP Ledger.

---

## Vue d’Ensemble

Ce projet illustre comment des actifs réels peuvent être **tokenisés**, **gérés** et **échangés** grâce à la technologie blockchain.  
Il s’appuie sur le **XRP Ledger (XRPL)** pour sa rapidité et ses faibles coûts, ainsi que sur **Xaman (XUMM)** pour l’authentification sécurisée et la signature des transactions.

---

## Fonctionnalités

### Tokenisation
- Support des **Issued Currencies (tokens fongibles)** et des **XLS-20 NFTs (tokens non fongibles)**  
- Création, gestion et transfert des tokens directement sur le XRPL  

### Conformité
- Système **KYC**, **whitelist** et **blacklist** intégré on-chain  
- Seuls les utilisateurs vérifiés peuvent détenir ou échanger des actifs tokenisés  

### Indexer en Temps Réel
- Synchronisation automatique entre l’état de la blockchain et l’application  
- Surveillance des transactions XRPL (mint, transfert, swap, etc.) en temps réel  

### Échanges On-Chain
- Intégration avec le **DEX / AMM natif du XRP Ledger**  
- Fourniture de liquidité initiale par les créateurs du projet  

### Oracle
- Connexion à une **API externe** pour obtenir des données réelles (prix, indice, etc.)  
- Mise à jour automatique des valeurs sur le ledger via des scripts Node.js  

---

## Stack Technique

| Couche | Technologie |
|--------|--------------|
| **Blockchain** | XRP Ledger TestNet |
| **Portefeuille** | Xaman |
| **Backend** | Node.js |
| **Frontend** | React.js / Vite |
| **Oracle** | Node.js |

---

## Installation & Exécution

### 1️⃣ Cloner le dépôt
```bash
git clone git@github.com:STom6/blockchain.git
```

2️⃣ Installer les dépendances
```bash
Backend :
cd WebApp/Backend
npm install

Front-end :
cd WebApp/Backend
npm install
```

3️⃣ Lancer le backend
```bash
npm run start
```

4️⃣ Lancer le frontend
```bash
npm run start
```

5️⃣ Connexion via Xaman
Ouvrez votre application Xaman (XUMM)
Scannez le QR code affiché sur l’interface web
Signez et validez les transactions directement depuis votre portefeuille
