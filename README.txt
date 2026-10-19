JBI HUB — Espace de travail partagé
================================

La même PWA que l'ancienne IA Académie, reconstruite comme un outil de gestion de projets.
La formation a été RETIRÉE de la version actuelle. Son code d'origine a été
préservé dans la branche GitHub "archive/ancienne-ia-academie-2026-10-19".

Modules :
- Plusieurs projets, avec leur propre espace.
- Content Studio : pages de documents à blocs façon Notion, par projet.
  * Créer une page vierge ou un modèle fiche produit Shopify / Meta Ads / e-mail.
  * Texte, titres, blocs individuels à copier, notes, séparateurs.
  * « Coller maintenant » : crée un bloc avec le contenu du presse-papiers si le navigateur le permet.
  * Copier chaque bloc séparément ou copier tout le document.
  * Déplacer un bloc avec les flèches, dupliquer, insérer entre deux blocs.
  * Ctrl/Cmd + Entrée : nouveau bloc sous le bloc actuel.
  * Enregistrement automatique local ou partagé une fois Supabase configuré.
  * Recherche de pages et de textes, export d'une page en .txt.
  * Statut simple « Brouillon », « À valider », « Prêt à coller » pour éviter la publication d'un texte non relu.
  * Les anciens textes sont récupérables via « Importer ici » dans une page (ils ne sont pas effacés automatiquement).
- Accès et identifiants, mots de passe chiffrés côté navigateur.
- Copywriting par projet (hooks, publicités, scripts, landing pages).
- To-do list avec responsable, priorité, date et statut.
- Export/import JSON local, PWA installable sur iPhone et ordinateur.

Le Content Studio ne permet pas encore l'édition simultanée caractère par caractère :
les modifications sont synchronisées entre appareils après sauvegarde,
mais deux personnes écrivant en même temps dans le même bloc peuvent écraser la version de l'autre.
Il est préférable d'attribuer chaque page à un éditeur principal.

ATTENTION : il existe deux modes
1. LOCAL (immédiat) : les informations restent sur l'appareil.
   Un lien seul ne synchronise PAS les associés.
2. ÉQUIPE (après configuration Supabase) : connexion individuelle par e-mail,
   autorisation via liste blanche + RLS, données partagées en temps réel.

COMMENT ACTIVER LE MODE ÉQUIPE (10 étapes)
1. Créer un projet gratuit sur https://supabase.com .
2. Dans "SQL Editor", coller et exécuter le fichier supabase-setup.sql.
3. Ajouter les adresses des associés dans la liste blanche avec la commande :
   insert into public.workspace_members(email)
   values ('associe1@exemple.com'),('associe2@exemple.com')
   on conflict(email) do nothing;
4. Dans "Authentication > Users", inviter ces mêmes membres ("Invite user").
   La PWA ne crée pas automatiquement de nouveaux comptes.
5. Dans "Authentication > URL Configuration", ajouter l'URL complète de la PWA
   aux URL de redirection autorisées (https://...github.io/ai-academy/).
6. Dans "Project Settings > API", récupérer l'URL et la clé PUBLIQUE
   (anon key ou publishable key). NE JAMAIS copier la service_role/secret key.
7. Ouvrir la PWA > Paramètres et saisir l'URL et la clé publique.
8. Se connecter par lien e-mail; seules les adresses invitées sont autorisées.
9. Pour éviter de reconfigurer chaque appareil, ajouter les valeurs publiques
   dans config.js et redéployer. La protection est assurée par Supabase RLS,
   pas par la confidentialité de cette clé publique.
10. Choisir une phrase secrète commune d'au moins 12 caractères pour le coffre.
    La transmettre séparément, par canal sûr. Ne jamais la publier dans le code.

SÉCURITÉ
- Le dépôt GitHub est public; la PWA n'héberge aucun secret de serveur.
- Les mots de passe sont chiffrés AES-GCM / PBKDF2 (240 000 itérations, SHA-256)
  avant stockage. Chaque entrée a un salt et un IV distinct.
- Le titre, l'identifiant et l'URL des comptes ne sont pas chiffrés.
- La phrase secrète n'est conservée qu'en mémoire durant la session ouverte.
- Les membres autorisés sont tous éditeurs; pas de rôles granulaire pour la V1.
- Si la phrase est perdue, les mots de passe ne pourront plus être déchiffrés.
- Pour les services sensibles, privilégier l'invitation d'associés ou un gestionnaire
  de mots de passe dédié plutôt qu'un login commun.
- Ne pas utiliser le coffre avant de tester la connexion sécurisée de l'équipe.

INSTALLER
iPhone : ouvrir dans Safari > Partager > Ajouter à l'écran d'accueil.
Ordinateur : ouvrir dans Chrome/Edge > Installer l'application.
La consultation hors connexion de l'interface est possible. Le mode Équipe
nécessite Internet pour lire/modifier les données.

Version : JBI Hub V2 « Content Studio » — 2026-10-19
Tests de logique réussis : sélection des projets, création de pages, modèles Shopify,
édition/sauvegarde, copie individuelle, statut de validation, recherche et collage rapide.
Le déploiement public et la synchronisation Supabase doivent être vérifiés avec les
vrais comptes de l'équipe.


V2 — STUDIO DE CONTENU COLLABORATIF (19/10/2026)
- Dans chaque projet : ouvrir "Vos pages & blocs".
- Bouton "Nouvelle page" : choisir Page vierge, Fiche produit Shopify,
  Publicité Meta ou E-mail marketing. Chaque modèle contient des blocs préparés.
- Coller un texte directement dans un bloc : le contenu est enregistré
  automatiquement (dans le navigateur en local ou dans Supabase en mode équipe).
- "Coller maintenant" tente de lire le presse-papiers, sinon crée un bloc vide
  prêt à recevoir du texte via Coller sur iPhone ou Ctrl/Cmd+V sur ordinateur.
- Chaque bloc a son propre bouton COPIER pour envoyer le texte brut au presse-papiers.
- "Copier toute la page" copie les blocs dans leur ordre.
- Type de bloc modifiable : texte, titre, bloc à copier, note, séparateur.
- Déplacement des blocs par ↑ et ↓, duplication, suppression.
- Ajouter un nouveau bloc n'importe où via + entre les blocs.
- Raccourci Ctrl/Cmd+Entrée : créer un bloc sous celui en cours.
- Renommage, suppression et export .txt de la page.
- Les anciens textes enregistrés avec le module Copywriting restent disponibles :
  bouton "Importer ici" pour les transformer en blocs, sans perte de données.
- Barre latérale des pages avec recherche et état Brouillon / À valider / Prêt
  si le suivi éditorial a été activé dans l'interface.
- Nouveau logo d'application JBI Hub pour l'écran d'accueil.

LIMITES ACTUELLES À CONNAÎTRE
- Sans Supabase configuré, un associé ouvrant le même lien ne verra pas les
  modifications des autres. Ne confondez pas déploiement et synchronisation.
- Le suivi en temps réel nécessite Internet. Les modifications locales hors
  connexion NE SE SYNCHRONISENT PAS automatiquement après activation du cloud.
- Le contenu des blocs est en texte brut, pensé pour un copier-coller propre
  vers Shopify/Meta ; pas d'éditeur riche HTML/WYSIWYG pour l'instant.
- L'enregistrement automatique sauvegarde à la fin d'une courte pause (~650 ms).
- Le contenu est partagé entre les membres autorisés ; tout le monde peut
  modifier/supprimer les pages en V2. Pas de commentaires ni permissions par page.
