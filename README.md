# Deadlock Tracker

Site de statistiques pour **Deadlock** (Valve) : recherche de joueur, rang, stats par héros, historique de matchs et détail des parties.

- Données : [Deadlock API](https://api.deadlock-api.com) (gratuite, appelée directement depuis le navigateur)
- Images (héros, items, rangs) : `/v1/assets` de Deadlock API

## Structure

```
index.html          page unique
css/style.css       styles
js/main.js          routeur (#/…) et évènements
js/api.js           appels à l'API, cache, gestion des limites
js/assets.js        héros, items, rangs (+ LOCAL_IMAGES pour vos propres images)
js/ui.js            utilitaires d'affichage
js/views/           pages : accueil/recherche, joueur, match
```

Aucun outil de build : le site fonctionne tel quel sur GitHub Pages.

## Feuille de route

1. ✅ Recherche, profil joueur, historique, détail d'un match
2. Méta des héros et des items
3. Classement par région
4. Parties en direct
5. Vos propres images (remplir `LOCAL_IMAGES` dans `js/assets.js`)

## Limites connues

L'historique de matchs n'est complet que pour les comptes amis avec un bot Deadlock API (offre Patreon). Pour les autres, le site affiche les matchs que l'API a stockés et l'indique clairement.

Projet communautaire non affilié à Valve.
