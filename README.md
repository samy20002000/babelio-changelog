# Nouveautés de l'application Babelio

La source du changelog public, publié sur GitHub Pages à chaque mise en
production.

## Ajouter une version

1. Créez `releases/<date>-<version>.md`. Le nom est libre : seules les
   métadonnées comptent, et les versions se classent par date.
2. Déposez les captures dans `assets/<version>/`. Une image plus large que
   haute — un montage de plusieurs écrans — prend toute la colonne.
3. Poussez sur `main` : le site se régénère tout seul.

Le format ne varie pas d'une version à l'autre, c'est ce qui permet d'en
tirer deux sorties d'une seule source :

```markdown
---
version: "0.206.0"
build: 283
date: 2026-09-18
platforms: [android, ios]
---

## Nouveautés

### Le titre de la nouveauté
![Ce que montre la capture](../assets/283/exemple.png)
Ce qu'elle change pour le lecteur, en deux ou trois phrases.

## Corrections

- Ce qui ne marchait pas, et qui marche.
```

Écrivez du côté du lecteur : ce qu'il gagne, pas le nom du composant. Une
capture par nouveauté marquante, deux ou trois par version au maximum —
au-delà, personne ne les produira.

## Ce que la publication fabrique

`npm run build` lit `releases/` et écrit dans `docs/` :

- **`index.html`** — la page que lisent les lecteurs ;
- **`index.json`** — les mêmes versions en données, pour l'écran
  « Quoi de neuf » de l'application.

Rien à installer : le script n'utilise que Node.
