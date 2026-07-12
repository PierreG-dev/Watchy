# Monter un disque USB pour Watchy — Raspberry Pi OS Lite 64-bit

Guide pas-à-pas pour préparer un stockage USB persistant sur RPi 4 (Pi OS Lite 64 bits, user `pi` UID 1000) et l'exposer au conteneur Watchy.

Objectif final :
- Disque USB monté automatiquement au boot sous `/mnt/<nom>`
- Survit à un débranchement / reboot sans bloquer le démarrage
- Écrivable par l'utilisateur `watchy` (UID 1000) dans le conteneur
- Visible dans l'UI Watchy → Settings → Backup storage

---

## 1. Brancher le disque et l'identifier

```bash
lsblk -f
```

Repère ta clé/SSD USB. Exemple de sortie :

```
NAME        FSTYPE   LABEL     UUID                                 MOUNTPOINT
sda
└─sda1      ext4     backup    1a2b3c4d-....-............
```

Note :
- Le **device** (`/dev/sda1`)
- Le **FSTYPE** (`ext4`, `exfat`, `ntfs`, `vfat`…)
- L'**UUID**

Si `FSTYPE` est vide → le disque n'a pas de système de fichiers, passe à l'étape 2. Sinon saute à l'étape 3.

---

## 2. (Optionnel) Formater le disque

**⚠️ Détruit toutes les données du disque.** Vérifie 3× le nom du device avant.

Recommandé : **ext4** (permissions Linux natives, pas de bidouille `uid=`).

```bash
sudo umount /dev/sda1 2>/dev/null || true
sudo mkfs.ext4 -L backup /dev/sda1
```

Si tu tiens à exFAT (interopérable Windows/Mac) :

```bash
sudo apt install -y exfatprogs
sudo mkfs.exfat -n backup /dev/sda1
```

Récupère le nouvel UUID :

```bash
sudo blkid /dev/sda1
```

---

## 3. Créer le point de montage

```bash
sudo mkdir -p /mnt/usb-backup
```

Le nom `usb-backup` deviendra le libellé affiché dans l'UI Watchy. Choisis ce que tu veux (`ssd`, `backup-1`, etc.).

---

## 4. Ajouter l'entrée fstab (montage automatique au boot)

Édite :

```bash
sudo nano /etc/fstab
```

Ajoute **une** de ces lignes selon le FS (remplace l'UUID par le tien) :

### ext4

```
UUID=1a2b3c4d-....-............  /mnt/usb-backup  ext4   defaults,nofail,x-systemd.device-timeout=10s  0  2
```

### exFAT

```
UUID=XXXX-XXXX  /mnt/usb-backup  exfat  defaults,nofail,uid=1000,gid=1000,umask=0002,x-systemd.device-timeout=10s  0  0
```

### NTFS

```
UUID=XXXXXXXXXXXXXXXX  /mnt/usb-backup  ntfs-3g  defaults,nofail,uid=1000,gid=1000,umask=0002,x-systemd.device-timeout=10s  0  0
```

(Pour NTFS : `sudo apt install -y ntfs-3g` d'abord.)

### Options clés — pourquoi

- **`nofail`** : si le disque est débranché au boot, le système démarre quand même (sinon le RPi reste bloqué en emergency mode).
- **`x-systemd.device-timeout=10s`** : n'attend pas 90s si le device n'apparaît pas.
- **`uid=1000,gid=1000,umask=0002`** (exFAT/NTFS uniquement) : donne l'ownership à l'utilisateur `pi` = `watchy` dans le conteneur. **Sans ça, l'app verra `writable=false`.** ext4 n'en a pas besoin, il utilise les permissions Unix natives.

---

## 5. Monter et tester

```bash
sudo systemctl daemon-reload
sudo mount -a
```

Aucune erreur = c'est bon. Vérifie :

```bash
df -h /mnt/usb-backup
mount | grep usb-backup
```

Test d'écriture avec le bon utilisateur :

```bash
sudo -u pi touch /mnt/usb-backup/.watchy-test && sudo -u pi rm /mnt/usb-backup/.watchy-test
echo "OK"
```

### ext4 seulement : ajuster l'ownership

ext4 conserve les permissions du FS. À faire une seule fois après le premier montage :

```bash
sudo chown -R 1000:1000 /mnt/usb-backup
sudo chmod 775 /mnt/usb-backup
```

---

## 6. Reboot de vérification

```bash
sudo reboot
```

Après redémarrage :

```bash
df -h /mnt/usb-backup
```

Le disque doit être remonté automatiquement.

---

## 7. Configurer Docker Compose côté Watchy

Dans le `docker-compose.yml` de Watchy, le bind doit être **`/mnt` → `/app/mounts`** avec la propagation `rslave` (pour voir les montages qui apparaissent après le démarrage du conteneur — hot-plug USB).

```yaml
services:
  watchy:
    # ...
    volumes:
      - watchy-data:/app/data
      - type: bind
        source: /mnt
        target: /app/mounts
        bind:
          propagation: rslave
    environment:
      MOUNTS_ROOT: /app/mounts
      DATA_DIR: /app/data
```

**Ne bind pas** un sous-dossier précis (`/mnt/usb-backup:/app/backups`) — tu perdrais la découverte dynamique et l'écran de sélection dans l'UI ne servirait à rien.

Démarre / redémarre :

```bash
docker compose up -d
```

---

## 8. Vérifier dans Watchy

1. Login → **Settings** → panneau **Backup storage**
2. Le sous-dossier `usb-backup` doit apparaître avec :
   - taille totale / libre correcte
   - `mount point` : ✔
   - `writable` : ✔
3. Le sélectionner → sauvegarder
4. Aller sur **Dashboard**, aucune bannière d'avertissement stockage
5. Lancer un backup test depuis **Targets** → un dossier `Watchy/<db>/` apparaît sur le disque

---

## Déployer via Coolify

Coolify orchestre le `docker-compose.yml` du repo — la préparation hôte (étapes 1 → 6) reste **identique**, elle se fait en SSH sur le Pi avant de créer la ressource dans Coolify.

### 1. Ajouter le Pi comme serveur dans Coolify

Dans l'UI Coolify → **Servers** → **+ Add** → renseigner l'IP du Pi + la clé SSH. Coolify installe son agent.

### 2. Créer la ressource

**Resources** → **+ New** → **Docker Compose Empty** (ou **Public Repository** si tu pointes sur ton repo Git).

- **Build pack** : `Docker Compose`
- **Repository** : ton fork/repo Watchy
- **Branch** : `main`
- **Docker Compose Location** : `/docker-compose.yml`
- **Server** : le Pi ajouté à l'étape 1

### 3. Variables d'environnement

Onglet **Environment Variables** → coller le contenu de ton `.env` (voir `.env.example`).

**⚠️ Le piège `$` de `APP_PASSWORD_HASH`** : dans l'UI Coolify les variables sont posées telles quelles dans un `.env` généré, donc **échappe chaque `$` en `\$`** exactement comme documenté dans `CLAUDE.md`. Sinon → 401 permanents au login.

Génère le hash sur ta machine :

```bash
npm run hash-password
```

Le script sort déjà la forme échappée — copie-la telle quelle.

Génère `SESSION_SECRET` :

```bash
openssl rand -hex 48
```

### 4. Persistent Storage (le point sensible)

Coolify a un onglet **Storages** qui gère les volumes/binds automatiquement. **Ne double pas** ce qui est déjà dans le compose — laisse le `docker-compose.yml` être la source de vérité :

- Le **named volume** `watchy-data` est créé par Coolify automatiquement, aucune action requise.
- Le **bind** `/mnt → /app/mounts` avec `propagation: rslave` est déclaré dans le compose. Coolify le respecte tel quel.

Si Coolify t'affiche un avertissement « bind mount detected », c'est OK — approuve. C'est exactement ce qu'on veut.

### 5. Port & domaine

- **Ports Exposes** : `3000`
- **Domain** : ajoute ton domaine (ex : `watchy.tondomaine.fr`) — Coolify configure Traefik + Let's Encrypt automatiquement.
- **⚠️ HTTPS obligatoire en prod** : le cookie de session est `Secure` (voir `lib/session.ts`). Sans TLS, tu ne pourras pas te connecter. Coolify gère le certif tout seul si le DNS pointe bien sur le Pi.

### 6. Déployer

Clique **Deploy**. Coolify :
1. Clone le repo
2. Build l'image (long la 1ère fois sur RPi 4 — ~10-15 min, mongodump ARM64 se télécharge)
3. Lance le conteneur avec le bind `/mnt`

Suis les logs dans l'onglet **Deployments**.

### 7. Vérifier

- **Healthcheck** dans Coolify passe au vert (hit `/api/healthz`)
- Ouvrir le domaine → écran login
- Login → Settings → le disque `usb-backup` apparaît

### Gotchas spécifiques Coolify

- **Rebuild après changement de `.env`** : les modifs de variables demandent un redeploy complet (pas juste restart), sinon le nouveau `.env` n'est pas régénéré dans le conteneur.
- **Ne pas cocher « Force HTTPS redirect »** avant que le certif Let's Encrypt soit émis, sinon boucle de redirection.
- **Coolify recrée le conteneur à chaque deploy** — grâce à `rslave` et au volume nommé `watchy-data`, ni la config (`db.json`) ni la visibilité des USB ne sont perdues.
- **Logs** : `docker logs <container>` en SSH reste plus lisible que l'UI Coolify pour débugger le scheduler node-cron.

---

## Ajouter d'autres disques

Répète étapes 1 → 6 avec un autre point de montage (`/mnt/ssd`, `/mnt/backup-2`…). Ils apparaîtront automatiquement dans l'UI sans redémarrer le conteneur (grâce à `rslave`).

---

## Dépannage

**Le disque n'apparaît pas dans l'UI**
- `mount | grep /mnt` sur l'hôte : est-il vraiment monté ?
- `docker compose exec watchy ls /app/mounts` : le conteneur le voit-il ? Sinon → propagation manquante, recréer le conteneur (`docker compose up -d --force-recreate`).

**`writable: false` dans l'UI**
- exFAT/NTFS : options `uid=1000,gid=1000,umask=0002` manquantes dans fstab.
- ext4 : `sudo chown -R 1000:1000 /mnt/usb-backup`.

**Le RPi ne boote plus après édition de fstab**
- Tu as oublié `nofail`. Boot en mode recovery (ou monte la SD sur un autre poste) et corrige `/etc/fstab`.

**Le disque disparaît après un débranchement à chaud**
- Normal. Rebranche → il sera remonté par udev/systemd. Si non : `sudo mount -a`.

**mongodump échoue avec « permission denied »**
- Vérifie le propriétaire du sous-dossier `Watchy/` créé sur le disque : doit être `1000:1000`.
