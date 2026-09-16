# Sede

Chat interno da empresa (estilo Discord): canais de texto, salas de voz/vídeo/tela, cargos com permissões e painel HQ.

## O que faz

- Servidores e canais (texto e voz)
- Cargos com permissões (mídia + gestão: pessoas, servidores, cargos, salas, HQ)
- HQ: visão geral, pessoas, servidores e cargos
- Presença em tempo real (SSE) e huddles WebRTC

## Requisitos

- **Node.js 20+**
- Opcional em produção: **MySQL 8** (banco próprio — não use o do GLPI)

## Instalação rápida (desenvolvimento)

```bash
git clone https://github.com/gabriellsd/sede.git
cd sede
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Sem variáveis `MYSQL_*`, os dados ficam em `data/store.json` (criado automaticamente).

### Contas demo

Senha de todas: **`sede123`**

| E-mail | Perfil |
|--------|--------|
| `admin@sede.local` | Admin |
| `rh@sede.local` | Recursos Humanos |
| `novo@sede.local` | Em integração |
| `colab@sede.local` | Colaborador |

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Desenvolvimento (hot reload) |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build (`next start`) |
| `npm run db:setup` | Cria tabelas MySQL (precisa de `.env.local`) |

## MySQL (produção)

1. Crie um banco e usuário **só do Sede** (nunca o schema do GLPI):

```sql
CREATE DATABASE sede CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sede'@'localhost' IDENTIFIED BY 'SENHA_FORTE';
GRANT ALL PRIVILEGES ON sede.* TO 'sede'@'localhost';
FLUSH PRIVILEGES;
```

2. Configure o ambiente:

```bash
cp .env.example .env
# edite MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
# em HTTPS: SEDE_SECURE_COOKIES=true
```

3. Aplique o schema e suba:

```bash
node scripts/db-setup.mjs
# ou, com .env.local: npm run db:setup
npm run build
npm start
```

Na primeira subida com banco vazio, o app grava cargos, canais e usuários demo.

Schema: [`sql/schema.sql`](sql/schema.sql)  
Deploy no Ubuntu ao lado do GLPI: [`deploy/UBUNTU.md`](deploy/UBUNTU.md)

## Variáveis de ambiente

Veja [`.env.example`](.env.example).

| Variável | Uso |
|----------|-----|
| `MYSQL_HOST` | Se definido (junto com user/database), usa MySQL |
| `MYSQL_PORT` | Padrão `3306` |
| `MYSQL_USER` / `MYSQL_PASSWORD` | Credenciais do banco `sede` |
| `MYSQL_DATABASE` | Nome do banco (ex.: `sede`) |
| `SEDE_SECURE_COOKIES` | `true` atrás de HTTPS |

## Funcionamento

1. Login com e-mail/senha → cookie de sessão  
2. Rail de servidores à esquerda; HQ (casa) para gestão  
3. Canais de texto: chat com permissão por cargo  
4. Canais de voz: mic/câmera/tela conforme o cargo  
5. HQ → Pessoas / Servidores / Cargos (criar, editar, excluir conforme permissão)

**Importante em produção:** rode **um** processo Node (`next start` / systemd). Presença e voz ficam em memória nesse processo. Coloque Nginx + HTTPS na frente (necessário para WebRTC).

## Estrutura

```
sede/
├── deploy/UBUNTU.md    # Guia Ubuntu + Nginx + systemd
├── sql/schema.sql      # Tabelas MySQL
├── scripts/db-setup.mjs
├── src/app/            # Next.js App Router + APIs
├── src/components/     # UI (Workspace, HQ, voz…)
└── src/lib/            # store, auth, MySQL, hub SSE
```

## Licença

Uso interno / privado — ajuste conforme a política da sua empresa.
