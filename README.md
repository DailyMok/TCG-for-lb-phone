
*Les assets sont maintenant gérés indépendamment via un CDN R2 alimenté par mes soins*

Version LB-Phone sur base qb-core 

## 📝 Description

Application téléphone complète permettant aux joueurs de collectionner, échanger, acheter et exposer des cartes uniques directement depuis leur téléphone in-game. Système économique intégré avec compte bancaire dédié, taxation des échanges, packs payants et revente de sets à prix variable.

**Nouveau en v3 : TCG Hunt** — Module de chasse aux fragments intégré dans l'app TCG. Les joueurs explorent la carte de Los Santos et Cayo Perico pour capturer des fragments via un mini-jeu d'adresse. 7 fragments d'un même archétype = 1 carte TCG craftée. Inspiré de Pokémon Go.

**Nouveau en v3.7 : Cayo Perico, XP & Fonds de profil** — La carte Hunt s'étend à Cayo Perico avec stops et fragments dédiés. Système de progression XP avec 20 niveaux, récompenses débloquables (bordures, fonds de profil) et titres. Fonds de profil personnalisables avec opacité ajustable.

**Nouveau en v4 : Ajout de la fonctionnalité de duel, de l'item bouclier UwU et la mise en place d'une zone chaude : un fragment spawn/despawn toutes les 5 mins.**

⚠️ Assets sur mon Fork :
- Logo Application
- Icône carte (`cards.webp`) pour le header de l'app
- Icônes header custom (`Cours.webp`, `Contact.webp`)
- Actuellement +3300 cartes disponibles générées aléatoirement par workflow ComfyUI utilisant un LoRA entraîné par mes soins
- Bordures de profil et images de badges (TCG + Hunt)
- Fonds de profil (`bg-profile/`)
- `set_prices.csv` — cours des sets par archétype
- `tags.csv` — classification des cartes par archétype
- `tcg-stops.csv` — 33 TCG Stops (lieux emblématiques LS + Cayo Perico)
- `level_rewards.csv` — paliers XP et récompenses par niveau
- `map.webp` — carte GTA V avec Cayo Perico (4096x5000)
- `mapZones.webp` — carte des zones colorées avec Cayo Perico (4096x5000)
- `TCGstop.webp` / `Fragment.webp` — icônes marqueurs carte
- `LO.webp` — bouton switch Hunt dans le header

---

## 🖼️ Fonctionnalités

### 📦 Collection & Cartes gratuites

- 1 carte gratuite par jour qui s'accumule automatiquement (max 7)
- 1 carte par clic, le compteur diminue à chaque ouverture (stress -2)
- Système de streak : 7 jours consécutifs de claim → bonus 2 cartes (tolérance 48h)
- Recherche par numéro ou nom de carte (icône loupe)
- Tri par date ou catégorie, filtre par archétype avec compteurs
- Protection de carte (🔒) empêchant la vente dans un set

---

### 💰 Économie

- **Compte bancaire `tcg-service`** : compte business avec 10M$ initial, créé automatiquement
- **Taxe 7%** sur les échanges argent entre joueurs, versée sur le compte TCG Service
- **Pack hebdomadaire** : 7 cartes du pool libre, 50 000$ le 1er de la semaine, 250 000$ les suivants, reset chaque lundi
- **Revente de set** : 7 cartes non protégées d'un même archétype, prix variable lu depuis `set_prices.csv`, versé depuis le compte TCG Service
- **Page "Cours"** : classement des 28 archétypes avec prix de rachat et tiers de rareté (RARE / À surveiller / COMMUNE)

---

### ⭐ Système XP & Niveaux (v3.7)

- **Gain d'XP** sur les actions TCG : claim (+10), streak 7j (+50), pack hebdo (+30), échange (+25/mois par partenaire), vente de set (+75), capture fragment (+15), craft carte (+100), fragment event (+40)
- **20 paliers** de niveau (0 → 21 000 XP) avec titres : Débutant → Vétéran → Expert → Légende
- **Barre de progression** orange affichée sous le pseudo (Niv. X + titre)
- **Récompenses par niveau** : bordures et fonds de profil débloqués à certains paliers (configurables via `level_rewards.csv`)
- Anti-farm : XP d'échange limité à **1 fois par mois** par paire de joueurs
- Backfill XP optionnel pour récompenser les joueurs existants

---

### 👤 Profil & Personnalisation

- Pseudo unique alphanumérique (immuable)
- Bio éditable (50 caractères max)
- Avatar choisi depuis la collection de cartes (recherche par n°) ou galerie photos, avec crop interactif circulaire (drag + zoom)
- Bordures décoratives de profil (synced automatiquement depuis les assets), verrouillées par niveau
- **Fonds de profil** (v3.7) : image de fond personnalisable avec opacité ajustable (4 presets : 10%, 25%, 40%, 50% + valeur custom 5-100%), visible par tous les visiteurs du profil
- Vitrine personnelle : jusqu'à 4 cartes exposées avec descriptions
- Badges de progression, 6 catégories : Collectionneur, Échangeur, Marchand, Chasseur, Crafteur et Event

---

### 👥 Contacts TCG

- Demande de contact avec message optionnel (50 caractères max)
- Recherche de pseudo → accès au profil public
- Noms cliquables vers le profil public dans toutes les sections (acceptés, en attente envoyées, en attente reçues)
- Accès à la collection d'un contact depuis son profil ("Sa Collection")
- Suppression de contact avec popup de confirmation
- **Dernières activités Hunt** : feed des captures récentes de fragments par les contacts (20 min)

---

### 🔁 Échanges

- Proposer un échange : carte contre carte ou argent contre carte
- Taxe 7% affichée clairement (brut / taxe / net) dans la liste et "7% de taxe" dans la popup de proposition
- Le receveur peut accepter ou refuser (avec message optionnel)
- L'expéditeur peut annuler sa demande en attente
- Propositions liées (même carte demandée) groupées visuellement par couleur
- SMS de notification : acceptation, refus (avec motif), annulation

---

### 🖼️ Vitrine

- Jusqu'à 4 cartes exposées par joueur avec description optionnelle (30 caractères max)
- Intégrée à la page d'accueil en 2 onglets : Vitrine Globale / Vitrine Contacts
- Bouton refresh + scroll en bas → effet relax (stress -2, une fois par heure)
- Popup de remplacement quand la vitrine est pleine (4/4)
- Clic sur un pseudo/avatar → profil public du joueur

---
![LO](https://github.com/user-attachments/assets/e3f8a64e-c759-456f-a013-a0e3060a5bbc)

### 🗺️ TCG Hunt — Chasse aux fragments (v3)

#### Concept
Les joueurs explorent Los Santos et Cayo Perico pour capturer des **fragments de cartes TCG** disséminés sur la carte. 7 fragments d'un même archétype → **craft d'une carte TCG**. Le module est intégré directement dans l'app TCG via le bouton **LO** dans le header.

#### Fragments — Los Santos
- **30 fragments actifs** simultanément sur la carte, minimum 1km d'écart
- Durées de vie décalées (5 à 150 min au boot, 2h30 pour les remplaçants)
- **Rotation automatique** toutes les 5 min : les expirés sont remplacés par de nouveaux
- Pondération par rareté : 70% COMMUNE, 25% À surveiller, 5% RARE
- 11 zones d'exclusion océaniques pour éviter les spawns dans l'eau
- Détection passive à 1km, capture à 50m

#### Fragments — Cayo Perico (v3.7)
- **3 fragments actifs** simultanément, pool indépendant de LS
- Durées de vie décalées au boot : 20, 40, 60 min
- **Rotation** toutes les 20 min, durée de vie **1 heure**
- Distance minimum **200m** entre fragments
- Mêmes règles de rareté que LS

#### TCG Stops — Los Santos
- **10 stops actifs** parmi 31 définis dans `tcg-stops.csv` (lieux emblématiques de LS)
- Équilibre **5 nord + 5 sud** garanti, rotation toutes les 10 min
- Drops : 33% détecteur, 33% 2 seconde chance, 34% les deux
- Délai de 60s pour récupérer l'item, nécessité d'être hors du véhicule
- Lootable une fois par session de spawn — quand le stop respawn, il redevient lootable

#### TCG Stops — Cayo Perico (v3.7)
- **2 stops** sur l'île : Aérodrome et Antenne de communication
- **1 seul actif** à la fois, alternance automatique toutes les **30 minutes**
- Pool indépendant de LS

#### Carte interactive
- Carte GTA V avec Cayo Perico (4096x5000) avec drag et zoom
- **50 zones GTA** référencées (49 Los Santos + Cayo Perico)
- Toggle satellite / zones 
- Code couleur des marqueurs de l'application : 🟢 vert (>30min) / 🟡 jaune (10-30min) / 🟠 orange (<10min) / 🔴 rouge (déjà récupéré/capturé)
- Position du joueur, bouton recentrer
- Clic sur la carte → popup "Placer un point GPS"
- Clic sur un marqueur → popup avec infos, timer, bouton GPS

#### Mini-jeu de capture
- 13 secondes, 20 cibles séquentielles
- Clic sur cible = touché, clic loupé (fond) = retire la cible la plus ancienne
- Difficulté : COMMUNE/SURVEILLER identiques (quota 15/20), RARE (16/20) avec cibles plus rapides
- Après échec : bouton explicite "🎯 Utiliser une Seconde Chance" pour retenter (quota réduit de 5)
- Nécessité d'être hors du véhicule

#### Détecteur
- Consomme 1 item, révèle les 5 fragments les plus proches pendant 10 min
- Timer affiché à côté de la liste des fragments


#### Inventaire fragments
- Barres de progression X/7 avec 7 points indicateurs par archétype
- Triés par progression décroissante, regroupés par catégorie (Classique, Cute, Event)
- Bouton "Crafter" (icône `cards.webp`) quand 7/7
- Fragments capturés grisés + "Déjà capturé" en rouge dans la liste et sur la carte
- Items de départ : 3 détecteurs + 3 secondes chances
- Intégration craft : 7 fragments → attribution automatique d'une carte TCG

#### Badges Hunt (v3)
- **9 badges** en 3 catégories : Chasseur, Artisan, Événements
- Affichés dans le profil aux côtés des 3 catégories TCG existantes (6 catégories au total)

---

### 🎨 Interface

- **Header permanent** : Logo TCG (retour accueil) + icône carte avec double bulle de notifications (verte = cartes gratuites, rouge = échanges en attente) + **bouton LO centré** (switch Hunt) + icône Cours (custom) + icône Contacts (custom)
- **3 onglets** style réseau social : Vitrine Globale / Vitrine Contacts / Mon Profil
- **Page Hub** : claim + pack hebdo + vente de set + liste des échanges (accessible via l'icône carte)
- **Viewer plein écran** : "Mise en Vitrine" + Protéger (haut droite) + archétype affiché
- **Avatar centré** dans les barres titre des pages collection (clic = retour au profil)
- **Barre XP** orange sous le pseudo avec niveau et titre
- **Fond de profil** visible derrière le contenu avec opacité personnalisable
- Contraste mode clair amélioré (textShadow)
- **Hunt Home** : actualisation position, claim stop, détecteur, liste fragments avec timers
- **Hunt Map** : carte interactive complète avec zoom progressif persistant et GPS intégré

---

**## ✨ Améliorations possibles

### 🏢 Application gérée par une entreprise privée

- Exploitation commerciale de l'application TCG par un job dédié
- Bordures et fonds de profil exclusifs attribuables par l'entreprise à des joueurs spécifiques
- Événements spéciaux, packs exclusifs, offres limitées
- Prix dynamiques fixés par l'entreprise
- Commission modulable sur les échanges

### 🎃 Événements saisonniers

- Archétypes event (Halloween, Noël, etc.) avec cartes limitées
- Classification automatique via `tags.csv` et `set_prices.csv`

### 🗺️ TCG Hunt — Évolutions possibles

- Events Hunt : fragments rares annoncés à tous les joueurs (déjà codé côté serveur)
- Classement des chasseurs (leaderboard captures)
- Nouveaux stops sur Cayo Perico
- Zones exclusives Cayo avec archétypes dédiés

---

## ⚙️ Notes techniques

- Création automatique de toutes les tables au démarrage (pas de migration Prisma manuelle)
- Synchronisation des cartes, bordures, prix, fonds de profil et rewards depuis les assets à chaque redémarrage
- Re-tag automatique des archétypes NULL depuis `tags.csv`
- Architecture respectant les conventions SOZ (Provider / Module / RPC / NUI)
- Intégration complète téléphone (app + SMS + contacts + annuaire entreprise)
- **Hunt** : tables créées via `$executeRawUnsafe` (pas dans schema.prisma), dates converties en heure locale via `dateToMySQL()`, spawn engine sur `OnceStep.RepositoriesLoaded` (après migrations)
- **Hunt Cayo** : pool de stops et fragments totalement indépendant de LS (timers, rotation, bornes de spawn séparés)
- **Carte interactive** : compensation automatique du zoom téléphone NUI via `useZoomConfig()` pour la précision du clic GPS, zoom et toggle zones persistants via atoms jotai
- **XP** : calculé à la volée via `getLevelFromXp()`, pas stocké en tant que niveau en BDD — seul le total XP est persisté

---

## ✅ Impact

- Ajout d'une nouvelle application téléphone complète avec système économique
- v3 : ajout du module Hunt intégré dans l'app TCG existante
- v3.7 : extension Cayo Perico, système XP, fonds de profil personnalisables
- Développement parlant : aucun impact sur les systèmes existants
- Gameplay parlant : impact le stress au niveau indiqué, sink économique via taxe 7% et achats de packs, gameplay exploration via Hunt (LS + Cayo Perico), progression long-terme via XP
- Feature isolée et extensible à une entreprise privée**
