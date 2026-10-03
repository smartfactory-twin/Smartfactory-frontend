# SmartFactory Twin — Frontend React

Interface web de la plateforme de maintenance prédictive industrielle SmartFactory Twin.

## Stack

- **Vite + React** (JavaScript)
- **Tailwind CSS v3**
- **Axios** (appels API avec refresh JWT automatique)
- **React Router DOM v6** (navigation + routes protégées par rôle)
- **React Hook Form** (formulaires avec validation)
- **Lucide React** (icônes)

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env

# 3. Lancer le backend Django (dans un autre terminal)
# cd ../Smartfactory-backend && docker compose up

# 4. Démarrer le frontend
npm run dev
# → http://localhost:5173
```

## Variables d'environnement

| Variable | Valeur par défaut | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api` | URL de base de l'API backend |

## Structure

```
src/
├── components/
│   ├── common/     Button, Input, Alert, Spinner
│   └── layout/     AuthLayout (split-screen auth)
├── context/        AuthContext (state global auth)
├── hooks/          useAuth
├── pages/
│   ├── auth/       Login, ForgotPassword, ResetPassword, ResetSuccess
│   └── ...         Dashboards admin/technicien/opérateur (à venir)
├── routes/         AppRouter, ProtectedRoute
├── services/       api.js (axios), authService.js
└── utils/          constants
```

## Endpoints backend utilisés

| Service | Méthode | Endpoint |
|---|---|---|
| Login | POST | `/auth/login/` |
| Logout | POST | `/auth/logout/` |
| Refresh token | POST | `/auth/token/refresh/` |
| Mon profil | GET | `/auth/me/` |
| Mot de passe oublié | POST | `/auth/password-reset/` |
| Réinitialiser mdp | POST | `/auth/password-reset/confirm/` |
| Créer utilisateur (admin) | POST | `/auth/users/` |

## Rôles

| Rôle | Dashboard |
|---|---|
| `ADMIN` | `/admin/dashboard` |
| `TECHNICIEN` | `/technician/dashboard` |
| `OPERATEUR` | `/operator/dashboard` |

## Étapes suivantes

- [ ] Layout global (Sidebar + Navbar)
- [ ] Dashboards par rôle
- [ ] Module gestion utilisateurs (Admin)
- [ ] Module machines / capteurs
- [ ] Alertes et anomalies
