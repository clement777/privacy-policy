# Rejet du 30 juillet 2026 — build 1.0 (5) — ce qui est corrigé, ce qui reste à faire

Soumission `b98e0902-c3d6-45e8-b0cf-82551ac5dfa5`, testée sur iPad Air 11" (M3), iPadOS 26.6.
Quatre motifs. **Deux sont corrigés dans le code, deux se règlent dans App Store
Connect** — et ceux-là ne partiront pas avec un nouveau build tout seul.

---

## 1. Guideline 1.4.1 — Safety: Physical Harm ✅ corrigé dans le code

> The app includes medical information but does not include citations.

**Fait :** nouvel écran **SOURCES SCIENTIFIQUES** (`src/components/SourcesSheet.tsx`),
qui associe chaque coefficient du moteur à la publication d'où il vient, avec un
lien DOI cliquable. Les 7 références ont été vérifiées une par une.

| Ce que HYDRA calcule | Source |
|---|---|
| Besoin quotidien 32 mL/kg | EFSA 2010, *DRV for water* — `10.2903/j.efsa.2010.1459` |
| Bases physiologiques + clairance rénale (~1 L/h) | Jéquier & Constant 2010 — `10.1038/ejcn.2009.111` |
| Diurèse alcool 10 mL/g d'éthanol | Eggleton 1942, *J. Physiol.* — `10.1113/jphysiol.1942.sp003973` |
| Le degré compte plus que le volume | Polhuis et al. 2017, *Nutrients* — `10.3390/nu9070660` |
| Bière ≈ eau (indice d'hydratation) | Maughan et al. 2016, *AJCN* — `10.3945/ajcn.115.114769` |
| Sueur pilotée par la chaleur métabolique | Cramer & Jay 2016 — `10.1016/j.autneu.2016.03.001` |
| Débits de sudation observés | Baker 2017, *Sports Medicine* — `10.1007/s40279-017-0691-5` |
| Café non déshydratant à dose modérée | Killer et al. 2014, *PLoS ONE* — `10.1371/journal.pone.0084154` |

Accessible depuis **deux** endroits, dont un **avant** tout achat (Apple demande
que ce soit « easy for the user to find ») :

- onglet **WIDGETS → SCIENCE → SOURCES SCIENTIFIQUES**
- **paywall → lien « Sources »** en bas, donc visible sans abonnement

L'écran commence par : pas un dispositif médical, aucun diagnostic, moyennes de
population, consulter un professionnel de santé si besoin spécifique.

---

## 2. Guideline 2.1(a) — App Completeness ✅ corrigé dans le code

> no action took place when we tapped on Déjà un compte ? Se connecter.

Ce libellé existait à **trois** endroits. Les deux premiers (écran d'accueil du
questionnaire, paywall) naviguent bien. Le troisième — le lien en bas de l'écran
de compte — ne faisait que basculer un état interne : le texte d'accroche et le
libellé du bouton changeaient, **rien d'autre**. Sur un grand écran d'iPad, avec
les deux mêmes champs email/mot de passe qui dominent, ça se lit exactement comme
« rien ne s'est passé ». C'est là que le vérificateur a tapé : il arrive sur cet
écran en mode « créer un compte » juste après le questionnaire, et il cherchait à
se connecter avec le compte de test fourni.

**Fait :** le lien discret est remplacé par un **sélecteur à deux onglets**
en haut du formulaire — `SE CONNECTER` / `CRÉER UN COMPTE` — dont l'onglet actif
est surligné en vert. N'importe quel appui produit désormais un changement visuel
non ambigu.

> ⚠️ Je n'ai pas pu reproduire sur un iPad ici. Le diagnostic ci-dessus est le
> seul chemin où l'appui ne produisait effectivement aucun changement visible ;
> les deux autres liens sont fonctionnels et testés. **Avant de resoumettre,
> vérifie ce parcours dans le simulateur iPad Air 11" :** installation neuve →
> questionnaire → paywall → essai → écran de compte → appuie sur `SE CONNECTER`.

---

## 3. Guideline 2.1(b) — l'essai de 7 jours n'apparaît pas dans la feuille de paiement ✅ RÉGLÉ le 30/07

> Specifically, the 7 day trial is not reflected in the payment sheet.

**Ce n'est pas un bug de l'app.** L'écran annonçait 7 jours gratuits, mais
StoreKit n'a rien à afficher : **aucune offre introductive n'est configurée** sur
l'abonnement `com.shipply.hydraapp.monthly`. La feuille de paiement ne montre que
ce qui existe dans App Store Connect.

### ✅ Fait — offre créée le 30/07/2026

Vérifié dans App Store Connect : la colonne *Offres d'introduction (175)* affiche
« Gratuit la première semaine » pour les 175 pays, et les prix de base sont en
place (3,99 € en zone euro). L'app affichera donc « 7 JOURS GRATUITS » et
« COMMENCER L'ESSAI GRATUIT », le texte étant dérivé de `product.introPrice`.

<details>
<summary>Chemin suivi, pour mémoire (les libellés FR sont trompeurs)</summary>

Le libellé FR est **« Offres d'introduction »** (traduction de *Introductory
Offers*) — pas « Offres introductives », et ce n'est pas une section de la page
de l'abonnement mais un **onglet d'une page séparée**.

1. App Store Connect → **Abonnements** → groupe **HYDRA Pro** → **HYDRA Pro Mensuel**
2. Bloc **Prix de l'abonnement** → lien **« Prix et conceptions »** en haut à droite
3. On arrive sur la page **« Tarification de l'abonnement »**, qui a 5 onglets :
   `Prix de l'abonnement` · **`Offres d'introduction`** · `Offres de reconquête` ·
   `Codes d'offre` · `Offres promotionnelles`
4. Onglet **« Offres d'introduction »** → configurer :
   - Type : **Essai gratuit**
   - Durée : **1 semaine** — il n'existe pas d'option « 7 jours ». Les durées
     proposées sont 3 jours, 1–2 semaines, 1–6 mois, 1 an.
   - Pays/régions : **tous**
   - Date de fin : **aucune**

⚠️ **Ne pas confondre avec « Offres promotionnelles »** (dernier onglet) : celles-ci
ciblent les abonnés existants ou résiliés et se déclenchent par un jeton signé
côté serveur. Elles n'apparaissent pas dans la feuille de paiement d'un nouvel
utilisateur et ne corrigeraient donc pas le motif 2.1(b).

Prérequis et pièges :

- **Un prix de base doit exister.** Onglet `Prix de l'abonnement` → la France doit
  être à 3,99 €. Une offre d'introduction est un rabais sur un prix : sans prix,
  l'option ne s'affiche pas.
- **Non modifiable après création.** Pour changer l'offre il faut la supprimer et
  en recréer une. Vérifier type + durée + pays avant de confirmer.
- **Jusqu'à 1 h de propagation vers le sandbox.** Si l'essai n'apparaît pas tout
  de suite dans la feuille de paiement, attendre avant de conclure à un bug.
- Une personne ne peut consommer qu'**une seule** offre d'introduction par groupe
  d'abonnements — un compte de test déjà utilisé ne reverra pas l'essai.
- Le bouton **« Mettre à jour la vérification »** de la page de l'abonnement ne
  suffit pas : voir l'ordre de resoumission plus bas, les trois éléments doivent
  repartir ensemble.

</details>

### Côté code, en filet de sécurité ✅ fait

Le paywall ne promet plus jamais un essai que StoreKit n'a pas : le texte est
maintenant **dérivé de `product.introPrice`**. S'il n'y a pas d'offre gratuite
configurée, l'écran affiche le prix mensuel et le bouton devient `S'ABONNER` au
lieu de `COMMENCER L'ESSAI GRATUIT`. Impossible de refaire le même écart.

L'offre étant maintenant configurée, l'essai s'affiche automatiquement — et si
elle venait à expirer ou être supprimée, l'app basculerait d'elle-même sur le
prix mensuel sans nouveau build.

---

## 4. Guideline 2.3.2 — Accurate Metadata ⚠️ À FAIRE DANS APP STORE CONNECT

> your app description does not inform users that a purchase is required.

La description ne dit nulle part que l'app nécessite un abonnement payant.

**Fait côté app :** le paywall affiche désormais explicitement « HYDRA est une app
par abonnement : l'accès complet nécessite l'abonnement HYDRA Pro ».

**À faire :** remplacer l'intégralité du champ *Description* (App Store Connect
→ Version 1.0 → Description) par le texte ci-dessous. Il corrige aussi deux
défauts de la description précédente : elle affirmait que boire « un verre »
faisait remonter la barre, juste avant d'expliquer que l'alcool la fait chuter
(contradiction sur le mécanisme central, risque 2.3.2 à elle seule), et les liens
EULA / confidentialité y figuraient en double.

```
Ta vie n'est pas une jauge d'énergie infinie. HYDRA la transforme en barre
de vie, comme dans un jeu — et chaque verre d'eau, chaque café, chaque verre
d'alcool la fait monter ou descendre en direct.

Abonnement requis (7 jours d'essai gratuit, puis 3,99 €/mois).

COMMENT ÇA MARCHE
• Une barre de vie sur ton écran d'accueil et ton écran verrouillé (widget
  natif iOS), qui se vide toute seule selon ta physiologie réelle.
• Bois de l'eau ou un café : la barre remonte instantanément.
• L'alcool — le "poison" — la fait chuter plus vite qu'elle ne remonte.
• Le calcul prend en compte ton poids, ton sommeil et ton environnement
  (température, humidité, altitude) pour un besoin d'hydratation qui te
  correspond vraiment, pas une règle générique "2 litres par jour".

POURQUOI C'EST DIFFÉRENT
La plupart des apps d'hydratation te demandent de cocher des cases. HYDRA
transforme l'hydratation en un jeu simple à lire d'un coup d'œil : ta barre
de vie. Pas de graphiques à interpréter, pas de calculs à faire — juste une
couleur (vert, ambre, rouge) qui te dit où tu en es, là, maintenant.

RAPPELS INTELLIGENTS
Reçois une alerte avant que ta barre passe en zone ambre ou rouge, et des
rappels étalés dans la journée pour le nombre de verres qu'il te reste à
boire avant ton coucher — jamais après, jamais du bruit inutile.

CONFIDENTIALITÉ
Tes données (poids, journal de boissons) ne servent qu'à faire fonctionner
l'app. Aucune publicité, aucune revente de données, aucun tracker tiers.
Suppression de compte en un geste, directement dans l'app.

HYDRA fait référence à la consommation d'alcool à des fins de suivi
personnel et n'encourage pas sa consommation.

ABONNEMENT REQUIS

HYDRA est une application par abonnement. L'accès aux fonctionnalités
(barre d'hydratation en temps réel, widgets écran verrouillé et écran
d'accueil, historique et statistiques) nécessite l'abonnement HYDRA Pro.

• HYDRA Pro — abonnement mensuel à 3,99 €, après 7 jours d'essai gratuit
• L'abonnement se renouvelle automatiquement sauf annulation au moins
  24 h avant la fin de la période en cours
• Gestion et annulation à tout moment dans les réglages de ton compte Apple
• Conditions d'utilisation (EULA) :
  https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
• Politique de confidentialité :
  https://hydra-landing-sooty.vercel.app/privacy.html

HYDRA n'est pas un dispositif médical et ne fournit aucun diagnostic. Les
calculs reposent sur des coefficients physiologiques publiés, dont les
sources sont citées dans l'app (WIDGETS → SCIENCE → SOURCES SCIENTIFIQUES).
Consulte un professionnel de santé pour tout besoin d'hydratation spécifique.
```

~2 300 caractères (limite : 4 000).

> Vérifier que « aucun tracker tiers » reste cohérent avec la section
> **Confidentialité des apps** déclarée dans App Store Connect.

---

## Ordre de resoumission

1. **App Store Connect** : offre introductive sur l'abonnement (point 3)
2. **App Store Connect** : nouvelle description (point 4)
3. **Nouveau build** avec les corrections de code : `eas build -p ios --profile production`
   puis `eas submit -p ios`
4. Version 1.0 → sélectionner le nouveau build
5. **Une seule soumission** contenant les trois éléments : la version de l'app,
   le groupe d'abonnements **et** l'abonnement — via *Ajouter pour vérification*
   depuis la page de la version. Les trois sont repassés en « Rejeté » et doivent
   repartir ensemble.
6. Dans les **notes pour la vérification**, ajouter :

```
Corrections apportées suite au rejet du 30/07 :

- 1.4.1 : les sources scientifiques de tous les calculs sont désormais citées
  dans l'app avec liens DOI, accessibles sans abonnement via le lien
  « Sources » en bas du paywall, et via WIDGETS > SCIENCE > SOURCES
  SCIENTIFIQUES.
- 2.1(a) : sur l'écran de compte, le lien « Déjà un compte ? Se connecter » est
  remplacé par un sélecteur à deux onglets SE CONNECTER / CRÉER UN COMPTE, avec
  onglet actif surligné.
- 2.1(b) : une offre introductive « essai gratuit 1 semaine » a été configurée
  sur l'abonnement HYDRA Pro Mensuel. L'app lit l'offre depuis StoreKit et
  n'affiche « essai gratuit » que si l'offre existe réellement.
- 2.3.2 : la description mentionne explicitement l'abonnement requis, son prix
  et ses conditions de renouvellement.

Compte de test : <email> / <mot de passe>
```

---

## Ce qui n'est PAS lié au rejet mais part dans le même build

La latence du widget est corrigée (commit `bb747a7`) : un appui sur ＋EAU
mettait ~3 s à faire monter la barre et l'écran verrouillé 3 à 10 s à se
rafraîchir, parce que le moteur Swift du widget recalculait tout l'historique
~120 fois par rafraîchissement. Une génération de timeline passe de 12 s à 7 ms
sur un mois d'historique.
