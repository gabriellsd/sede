# Deploy Sede no Ubuntu (ao lado do GLPI)

O Sede roda em **Node.js** (Next.js). Use um **banco MySQL próprio** (`sede`), nunca o schema do GLPI.

## 1. Requisitos no servidor

- Ubuntu com MySQL já usado pelo GLPI
- Node.js **20+** (`node -v`)
- Nginx (ou Apache) na frente
- Domínio/subdomínio, ex.: `sede.suaempresa.com`
- HTTPS (Let’s Encrypt) — necessário para voz/WebRTC

## 2. Usuário e banco MySQL

No MySQL (como root), **sem tocar no GLPI**:

```sql
CREATE DATABASE sede CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sede'@'localhost' IDENTIFIED BY 'SENHA_FORTE';
GRANT ALL PRIVILEGES ON sede.* TO 'sede'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Código no servidor

```bash
sudo mkdir -p /var/www/sede
sudo chown $USER:$USER /var/www/sede
# copie o projeto para /var/www/sede (git clone, scp, rsync…)
cd /var/www/sede
cp .env.example .env
nano .env   # preencha MYSQL_* e SEDE_SECURE_COOKIES=true
npm ci
node scripts/db-setup.mjs   # cria as tabelas
npm run build
```

O `.env` deve ter algo como:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=sede
MYSQL_PASSWORD=SENHA_FORTE
MYSQL_DATABASE=sede
SEDE_SECURE_COOKIES=true
NODE_ENV=production
```

Na **primeira** execução (`npm start`), se o banco estiver vazio, o app grava os usuários/cargos demo.

## 4. Processo com systemd

`/etc/systemd/system/sede.service`:

```ini
[Unit]
Description=Sede (Next.js)
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/sede
EnvironmentFile=/var/www/sede/.env
ExecStart=/usr/bin/npm run start -- -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sede
sudo systemctl status sede
```

## 5. Nginx (subdomínio ao lado do GLPI)

```nginx
server {
  listen 80;
  server_name sede.suaempresa.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name sede.suaempresa.com;

  # ssl_certificate / etc. (certbot)

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
    proxy_buffering off;
  }
}
```

SSE (eventos/presença) e voz pedem proxy longo sem buffer — o bloco acima cobre isso.

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d sede.suaempresa.com
```

## 6. Contas iniciais (demo)

Senha padrão dos demos: `sede123`

| E-mail | Cargo |
|--------|--------|
| admin@sede.local | Admin |
| rh@sede.local | RH |
| novo@sede.local | Em integração |
| colab@sede.local | Colaborador |

Troque senhas e crie usuários reais pelo HQ depois do login.

## 7. Atualizar depois

```bash
cd /var/www/sede
git pull   # ou rsync do PC
npm ci
npm run build
sudo systemctl restart sede
```

## 8. Dev local sem MySQL

Sem `MYSQL_HOST` no `.env.local`, o app usa `data/store.json` como antes.

Com MySQL local:

```bash
cp .env.example .env.local
# edite as vars
node --env-file=.env.local scripts/db-setup.mjs
npm run dev
```

## Observações

- **Não** compartilhe o banco/usuário do GLPI com o Sede.
- Um único processo Node (`next start`) por máquina — o hub de voz/SSE fica em memória.
- Firewall: só 80/443 públicos; MySQL e porta 3000 só em localhost.
