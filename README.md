# Shopify → Recharge Webhook App

Application Node.js/Express qui écoute le webhook **`orders/paid`** de Shopify et crée automatiquement des *
*subscriptions Recharge** pour chaque ligne de commande éligible.

---

## Architecture

```
Shopify (orders/paid)
        │
        ▼ POST /webhooks/orders/paid
┌─────────────────────────────────────┐
│  1. Vérification HMAC (sécurité)    │
│  2. Identification des line items   │
│     → produits abonnement           │
│  3. Find or create Customer Recharge│
│  4. Find or create Address Recharge │
│  5. Create Subscription(s) Recharge │
└─────────────────────────────────────┘
        │
        ▼
   Recharge API
```

---

## Prérequis

- Node.js 18+
- Un store Shopify avec API Admin activée
- Un compte Recharge avec une clé API

---

## Installation

```bash
# 1. Cloner / copier le projet
cd shopify-recharge-app

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# → Éditer .env avec vos vraies clés
```

---

## Configuration (.env)

| Variable                           | Description                                  |
|------------------------------------|----------------------------------------------|
| `SHOPIFY_SHOP_DOMAIN`              | ex: `my-store.myshopify.com`                 |
| `SHOPIFY_API_CLIENT_ID`            | Client ID API Shopify                        |
| `SHOPIFY_API_CLIENT_SECRET`        | Client secret API Shopify                    |
| `RECHARGE_API_KEY`                 | Clé API Recharge                             |
| `DEFAULT_ORDER_INTERVAL_UNIT`      | `day`, `week`, ou `month` (défaut: `month`)  |
| `DEFAULT_ORDER_INTERVAL_FREQUENCY` | Fréquence numérique (défaut: `1`)            |
| `SUBSCRIPTION_VARIANT_IDS`         | IDs variants Shopify éligibles (vide = tous) |

---

## Démarrage

```bash
# Production
npm start

# Développement (rechargement auto)
npm run dev
```

Endpoints disponibles :

- `GET  /health` — vérification santé
- `POST /webhooks/orders/paid` — réception webhook Shopify

---

## Enregistrement du webhook Shopify

```bash
WEBHOOK_CALLBACK_URL=https://votre-serveur.com/webhooks/orders/paid \
node scripts/registerWebhook.js
```

> Pour les tests en local, utilisez [ngrok](https://ngrok.com/) pour exposer votre serveur :
> ```bash
> ngrok http 3000
> # Copiez l'URL HTTPS dans WEBHOOK_CALLBACK_URL
> ```

---

## Logique de sélection des line items

L'app détermine les produits à abonner dans cet ordre de priorité :

1. **`SUBSCRIPTION_VARIANT_IDS` configuré** → seuls ces variant IDs déclenchent une subscription
2. **Selling Plan Allocation présent** → produits avec un plan d'abonnement Shopify natif
3. **Fallback** → tous les line items de la commande

---

## Flux Recharge créé

Pour chaque line item éligible :

1. **Customer** → recherché par email, créé si absent
2. **Address** → recherchée par adresse+zip, créée si absente
3. **Subscription** → toujours créée (une par variant)

---

## Sécurité

- Chaque requête webhook est vérifiée via **HMAC-SHA256** avec le secret Shopify
- Réponse `200 OK` immédiate pour éviter les retries Shopify
- Traitement asynchrone post-réponse

---

## Structure du projet

```
shopify-recharge-app/
├── config/
│   └── index.js              # Chargement et validation des variables
├── scripts/
│   └── registerWebhook.js    # Enregistrement webhook Shopify
├── src/
│   ├── handlers/
│   │   └── orderHandler.js   # Logique métier principale
│   ├── middleware/
│   │   └── webhookVerifier.js # Vérification HMAC
│   ├── routes/
│   │   └── webhooks.js       # Routes Express
│   ├── services/
│   │   └── rechargeService.js # Appels API Recharge
│   └── server.js             # Point d'entrée
├── .env.example
└── package.json
```

---

## Déploiement recommandé

| Plateforme           | Notes                                             |
|----------------------|---------------------------------------------------|
| **Railway / Render** | Déploiement simple depuis GitHub, HTTPS inclus    |
| **Heroku**           | `Procfile: web: node src/server.js`               |
| **VPS (PM2)**        | `pm2 start src/server.js --name shopify-recharge` |
| **Docker**           | Voir ci-dessous                                   |

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```
