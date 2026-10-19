JBI HUB — Espace de travail partagé
================================

La même PWA que l'ancienne IA Académie, reconstruite comme un outil de gestion de projets.
La formation a été RETIRÉE de la version actuelle. Son code d'origine a été
préservé dans la branche GitHub "archive/ancienne-ia-academie-2026-10-19".

Modules :
- Plusieurs projets, avec leur propre espace.
- Accès et identifiants, mots de passe chiffrés côté navigateur.
- Copywriting par projet (hooks, publicités, scripts, landing pages).
- To-do list avec responsable, priorité, date et statut.
- Export/import JSON local, PWA installable sur iPhone et ordinateur.

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

Versions : JBI Hub V1 — 2026-10-19
