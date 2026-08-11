# HYDRA.IO — état du projet

Document de reprise. Toute nouvelle session (Claude Code, Claude, Cowork) doit
pouvoir démarrer avec ça et rien d'autre. **À tenir à jour** : quand un chiffre
ou une décision change, corrige-le ici plutôt que d'ajouter une ligne.

Dernière mise à jour : 11 août 2026.

---

## Le produit

Application iOS de suivi d'hydratation. La valeur tient dans **un widget
d'écran verrouillé** : une barre de vie qui se vide en continu, remonte quand
on appuie dessus pour logger un verre — **sans déverrouiller le téléphone**.
C'est la seule chose que l'app fait et que les concurrentes ne font pas ; toute
la communication doit montrer ce geste.

| | |
|---|---|
| Bundle | `com.shipply.hydraapp` |
| App Store | `6790794354` |
| Stack | Expo 51, workflow managé, RN 0.74, **pas de dossier `ios/`** |
| Widget | cible Swift, App Group `group.com.shipply.hydraapp` |
| Abonnement | RevenueCat, entitlement `HYDRA Pro`, `…monthly` à 3,99 €/mois |
| Landing | `hydra-landing-sooty.vercel.app`, déployée depuis `main` |

### Dépôt

- `hydra/` — l'application
- `hydra-landing/` — la landing (déployée par Vercel **depuis `main`**)
- Développement sur `claude/new-session-5eaaki`, puis report des fichiers de
  landing sur `main` pour déclencher le déploiement.

Le moteur Swift (`targets/widget/HydrationEngine.swift`) est un portage strict
du moteur TS. **20 tests de parité** (`src/engine/__parity__/`) garantissent que
les deux donnent le même résultat au millilitre près — ne jamais modifier l'un
sans l'autre.

---

## Les chiffres qui pilotent les décisions

### D'où viennent réellement les téléchargements (29 juil – 4 août)

| Source | Premiers téléchargements |
|---|---|
| **Recherche App Store** | **27** |
| App référente (TikTok, Instagram) | 5 |
| Navigation App Store | 4 |
| Site web référent (la landing) | **1** |

**73 % viennent de la recherche App Store**, canal qui ne reçoit aucun budget.
La landing a produit **un** téléchargement en une semaine.

### Ce que coûte un essai gratuit, par canal

| Canal | Coût/essai | Verdict |
|---|---|---|
| Meta → landing | ~25 € | abandonné |
| TikTok, vidéo « sujet » | ~6 € | abandonné |
| **TikTok, vidéo « produit »** | **2,33 €** | **le meilleur** |
| TikTok, carrousel | 6,66 € | clics accidentels |
| Apple Search Ads | jamais testé | à faire |

Seuil de rentabilité actuel : **~5 € par essai**.

### Le carrousel est un piège

Taux de clic 3,19 %, clic à 0,015 € — huit fois moins cher que la vidéo. Mais
**442 clics n'ont donné qu'un essai**. En mode photo, le bouton d'action est
collé à la zone de swipe : les clics sont majoritairement accidentels.
Si ces clics valaient ceux de la vidéo, on attendrait ~24 essais.

→ **Carrousel = organique. Vidéo = payant.**

### Le tunnel complet (11 août)

```
100 téléchargements
  ↓  7 %        ← LA PLUS GROSSE FUITE
  7 essais gratuits
  ↓  33 %
  2 abonnés payants réels  (+1 compte interne)
```

**93 personnes sur 100 téléchargent sans jamais démarrer l'essai.** Le paywall
est dur : elles abandonnent donc pendant le questionnaire, pendant l'écran de
préparation (7,6 s), ou devant le prix. **On ne sait pas laquelle** — l'app
n'est pas instrumentée.

Levier comparé, sur 100 téléchargements :

| Améliorer | De → à | Gain |
|---|---|---|
| Téléchargement → essai | 7 % → 12 % | **+5 essais** |
| Essai → payant | 33 % → 50 % | +1 abonné |

→ Le premier levier vaut cinq fois le second. **Instrumenter l'app passe avant
tout le reste.**

Conversion essai → payant mesurée sur une vraie cohorte : **2 sur 6 = 33 %**
(fourchette basse du secteur, 30-50 %).

### Revenus (11 août)

3 abonnements dont 1 compte interne → **2 payants réels, ~8 €/mois brut**.
Impressions App Store : 154 (4 août) → **592** (10 août), effet des vidéos
TikTok. Vues de fiche → téléchargement : ~31 %, la fiche reste excellente.

### Économie unitaire

| Configuration | Net/mois | Remboursement |
|---|---|---|
| Aujourd'hui : 3,99 €, commission 30 % | 2,79 € | 2,5 mois |
| + Small Business Program (15 %) | 3,39 € | 2,1 mois |
| + prix à 4,99 € | 4,24 € | 1,7 mois |
| + offre annuelle 29,99 € | 25,49 € encaissés | immédiat |

### Audience

71 % de femmes · 73 % ont 35 ans ou plus · France 57 %, La Réunion 10 %,
Martinique 9 %, Belgique 7 %, Suisse 2 %.
**La Réunion et la Martinique sont sur l'App Store français** — les inclure
explicitement dans les ciblages TikTok, sinon on perd 19 % de l'audience.

---

## Mesure

| Outil | Identifiant | Portée |
|---|---|---|
| App Store Connect | `pt=128511052` | `ct=tiktok_100k`, `ct=landing` |
| PostHog | projet `192333`, UE | **landing uniquement** — l'app n'est pas instrumentée |
| Pixel TikTok | `D9PK5V3C77UDV6S3K5T0` | + événement `ClickButton` sur le CTA |

⚠️ **Seuil Apple : en dessous de 5 comptes distincts, une campagne affiche zéro.**
Ne pas éclater le budget sur plusieurs `ct=` — croiser avec Ventes et tendances,
qui n'a pas de seuil.

---

## Décisions prises (ne pas relitiger sans données nouvelles)

1. **Le trafic payant va directement sur l'App Store**, pas sur la landing.
2. **Créa produit > créa sujet en payant** — mesuré : taux de clic doublé.
3. **Meta est en pause.** Objectif Trafic uniquement, car l'objectif
   Installations d'apps exige un compte `developers.facebook.com` bloqué par une
   vérification d'appareil (délai automatique de plusieurs jours, rien à forcer).
4. **Pas de SDK d'attribution** (TikTok, Meta) tant qu'un canal ne justifie pas
   l'investissement. Le jour venu : **un MMP** (AppsFlyer, gratuit sous 12 000
   conversions/mois), pas un SDK par réseau.

## Contraintes non négociables

- **HYDRA ne doit jamais être publiquement relié à CAREEAT / CHIPLI.** Vaut pour
  les champs annonceur et payeur de Meta (publics un an dans l'Ad Library) et
  pour le nom développeur Apple.
- **Aucun faux témoignage client.** Pas d'avis généré, pas d'avatar IA se
  présentant comme un utilisateur.
- **Aucune promesse de santé ferme.** « souvent », « ça peut venir de » — jamais
  « soigne » ou « guérit ». Motif de rejet publicitaire et App Store.
- **Aucune clé d'API dans le dépôt.**

---

## En attente

| | Effort | Impact |
|---|---|---|
| **`posthog-react-native` dans l'app** | 1 j | **priorité n°1** — 93 téléchargements sur 100 se perdent avant l'essai, on ne sait pas où |
| **Small Business Program** | 5 min | +18 % de marge, gratuit |
| **Offre annuelle 29,99 €** | quelques heures | remboursement immédiat de l'acquisition |
| **Soumettre le build 8** | — | contient 3 correctifs déjà faits (voir ci-dessous) |
| **ASO** — « hydra » ne fait pas sortir l'app | 1 version | premier canal, il fuit |
| **Apple Search Ads** | 20 min | achète le canal qui produit déjà 73 % |
| **Démarchage créateurs** | — | viser les niches « astuces iPhone », pas bien-être |

### Contenu du build 8 (fait, non soumis)

1. Correction du blocage 2.1(a) : le lien « Déjà un compte ? » restait inerte
   après connexion tant que `onboarded` était faux.
2. Note explicative sur le paywall pour les utilisateurs déjà connectés.
3. **Routage vers le guide du widget** : `initialRouteName = WIDGETS` au premier
   lancement, guide « écran verrouillé » ouvert automatiquement une seule fois
   (`widgetGuideSeen`, persisté, volontairement **non** synchronisé au cloud).

---

## Pièges rencontrés — ne pas repayer

- **Un `<link rel="stylesheet">` bloque le premier affichage de toute la page**,
  même si rien de visible n'utilise la police. Les polices Google coûtaient
  380 ms sur la landing pour un rendu qui n'en avait aucun besoin.
- **`position: fixed` + contenu centré = clics interceptés sur écran bas.** Le
  pied de page de la landing rendait le bouton inerte en mode paysage. Le bouton
  restait visible et parfaitement mort ; un visiteur a tapé 28 fois.
  → **Tester en paysage, pas seulement en portrait.**
- **Ne jamais mettre de backticks dans un message de commit passé en `-m`** —
  le shell les exécute. Utiliser `git commit -F fichier`.
- Les sessions Claude Code longues perdent leurs connecteurs MCP.
  **Ouvrir une session par chantier.**
