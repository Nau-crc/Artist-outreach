#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# bootstrap.sh — prepara un VPS Ubuntu 24.04 recién comprado en
# OVH para hospedar Artist Outreach.
#
# Uso (como root, dentro del VPS):
#   curl -fsSL https://raw.githubusercontent.com/<user>/Artist-outreach/main/server/bootstrap.sh | bash
# o bien tras hacer git clone:
#   sudo bash server/bootstrap.sh
#
# Hace:
#   - Actualiza el sistema.
#   - Instala Docker + Compose plugin.
#   - Crea usuario deploy con sudo docker sin password.
#   - Configura firewall UFW (SSH + HTTP + HTTPS).
#   - Instala fail2ban básico.
#   - Deja el repo clonado en /opt/artist-outreach y crea .env.production vacío.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Nau-crc/Artist-outreach.git}"
APP_DIR="/opt/artist-outreach"
DEPLOY_USER="deploy"

log() { echo -e "\033[1;34m[bootstrap]\033[0m $*"; }
warn() { echo -e "\033[1;33m[bootstrap]\033[0m $*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Este script debe ejecutarse como root (o con sudo)." >&2
  exit 1
fi

log "Actualizando sistema…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw fail2ban ca-certificates gnupg lsb-release

# ──── Docker ───────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker Engine + Compose plugin…"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
else
  log "Docker ya presente."
fi

systemctl enable --now docker

# ──── Usuario deploy ───────────────────────────────────────
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  log "Creando usuario $DEPLOY_USER…"
  adduser --disabled-password --gecos '' "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
  mkdir -p /home/$DEPLOY_USER/.ssh
  # Copia las claves autorizadas del root para que puedas entrar como deploy
  # desde la misma máquina desde la que entras como root.
  if [[ -f /root/.ssh/authorized_keys ]]; then
    cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/authorized_keys
    chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
  fi
else
  log "Usuario $DEPLOY_USER ya existe."
fi

# ──── Repo ─────────────────────────────────────────────────
if [[ ! -d "$APP_DIR/.git" ]]; then
  log "Clonando repo en $APP_DIR…"
  git clone "$REPO_URL" "$APP_DIR"
  chown -R $DEPLOY_USER:$DEPLOY_USER "$APP_DIR"
else
  log "Repo ya presente en $APP_DIR."
fi

if [[ ! -f "$APP_DIR/.env.production" ]]; then
  log "Creando plantilla .env.production…"
  cp "$APP_DIR/.env.production.example" "$APP_DIR/.env.production"
  chown $DEPLOY_USER:$DEPLOY_USER "$APP_DIR/.env.production"
  chmod 600 "$APP_DIR/.env.production"
  warn "Edita $APP_DIR/.env.production con los valores reales ANTES de levantar."
fi

# ──── Firewall ─────────────────────────────────────────────
log "Configurando firewall UFW…"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# ──── fail2ban ─────────────────────────────────────────────
log "Habilitando fail2ban…"
systemctl enable --now fail2ban

log "✓ Bootstrap completado."
echo
echo "Siguiente paso:"
echo "  1. Edita $APP_DIR/.env.production con valores reales."
echo "  2. Como usuario deploy:  su - $DEPLOY_USER"
echo "  3. Levanta:              cd $APP_DIR && docker compose up -d --build"
echo "  4. Aplica migraciones:   docker compose exec app node node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma"
echo
