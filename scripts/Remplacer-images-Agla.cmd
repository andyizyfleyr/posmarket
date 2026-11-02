@echo off
REM ============================================================================
REM  Remplacer les images des produits — Maison des boites et cosmetiques Agla
REM
REM  UTILISATION : glisse le dossier contenant tes photos HD sur ce fichier.
REM  (ou double-clique et tape le chemin du dossier quand il le demande)
REM
REM  Le script montre d'abord ce qu'il FERAIT. Rien n'est modifie tant que tu
REM  n'as pas repondu OUI a la question.
REM ============================================================================
chcp 65001 >nul
setlocal

title Remplacement des images produits

set "STORE=5b5ca452-6660-4405-88e8-500f08f4e402"
set "DOSSIER=%~1"

echo.
echo  ==========================================================
echo    Remplacement des images - Maison des boites Agla
echo  ==========================================================
echo.

REM --- 1. Trouver le dossier des photos -------------------------------------
if "%DOSSIER%"=="" (
    echo  Glisse le dossier de tes photos HD ici, puis appuie sur Entree.
    echo  ^(ou colle son chemin, par exemple D:\Photos HD^)
    echo.
    set /p "DOSSIER=  Dossier : "
    call set "DOSSIER=%%DOSSIER:""=%%"
)

if not exist "%DOSSIER%\" (
    echo.
    echo  [ERREUR] Dossier introuvable : "%DOSSIER%"
    echo.
    pause
    exit /b 1
)
echo  Dossier choisi : %DOSSIER%
echo.

REM --- 2. Se placer dans le projet ------------------------------------------
cd /d "%~dp0"
if not exist "package.json" (
    echo  [ERREUR] Ce fichier doit rester dans le dossier du projet posmarket.
    echo           Il est actuellement dans : %~dp0
    echo.
    pause
    exit /b 1
)

REM --- 3. Verifier que les cles existent ------------------------------------
if not exist ".env.local" (
    echo  [ATTENTION] Pas de fichier .env.local dans le projet.
    echo              Le script a besoin de DATABASE_URL et des cles R2.
    echo.
    pause
)

REM --- 4. Simulation ---------------------------------------------------------
echo  ----- ETAPE 1 : simulation (aucune modification) -----
echo.
call npm run images:replace -- --store "%STORE%" --dir "%DOSSIER%"
if errorlevel 1 (
    echo.
    echo  La simulation s'est arretee. Lis le message ci-dessus. Rien n'a ete modifie.
    echo.
    pause
    exit /b 1
)

REM --- 5. Confirmation -------------------------------------------------------
echo.
echo  ==========================================================
echo   Verifie le rapport CSV affiche plus haut.
echo   Les produits marques "aucun fichier" ne seront PAS modifies.
echo  ==========================================================
echo.
set /p "REPONSE=  Appliquer vraiment les changements ? (OUI/non) : "

if /i not "%REPONSE%"=="OUI" (
    echo.
    echo  Annule. Rien n'a ete modifie.
    echo.
    pause
    exit /b 0
)

REM --- 6. Application --------------------------------------------------------
echo.
echo  ----- ETAPE 2 : application -----
echo.
call npm run images:replace -- --store "%STORE%" --dir "%DOSSIER%" --apply

echo.
echo  ==========================================================
echo   Termine. Une sauvegarde a ete creee dans le dossier
echo   "backups". En cas de probleme, elle permet de revenir en arriere.
echo  ==========================================================
echo.
pause
