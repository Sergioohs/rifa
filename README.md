# 🎟️ Rifa Profissional (Backend + Banco MySQL + Painel Admin separado)

Projeto completo para rodar em **VPS Ubuntu** com:
- **Backend Node.js (Express)**
- **Banco MySQL**
- **Painel Admin (separado em /admin)**
- **Página Pública (em /)**
- **Exportar CSV + PDF**
- **Sorteio (somente pagos opcional)**
- **Autenticação JWT (Admin)**

> Tudo pronto para subir com **Docker** ou rodar direto com Node + PM2.

---

## ✅ Requisitos
### Opção A (recomendado): Docker
- Docker + Docker Compose

### Opção B: Rodar direto na VPS
- Node.js 18+ (ou 20+)
- MySQL 8+

---

## 🚀 Rodar com Docker (recomendado)
1. Entre na pasta:
```bash
cd rifa-profissional
```

2. Crie o `.env`:
```bash
cp backend/.env.example backend/.env
```

3. Suba tudo:
```bash
docker compose up -d --build
```

4. Abra no navegador:
- Página pública: `http://SEU_IP:8080/`
- Painel admin: `http://SEU_IP:8080/admin/`

5. Login do Admin (padrão):
- Email: `admin@admin.com`
- Senha: `admin123`

> Troque no `.env` depois (ADMIN_EMAIL e ADMIN_PASSWORD).

---

## 🧰 Rodar direto (Node + MySQL)
1. Configure MySQL e crie um banco (ex: `rifa_db`).
2. Copie e edite o `.env`:
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

3. Instale e rode:
```bash
cd backend
npm i
npm run start
```

4. Acesse:
- `http://SEU_IP:3000/`
- `http://SEU_IP:3000/admin/`

---

## 📦 Deploy com PM2 (sem Docker)
Dentro de `backend/`:
```bash
npm i
npm i -g pm2
pm2 start server.js --name rifa
pm2 save
pm2 startup
```

---

## 🗂️ Estrutura
- `backend/` API + serve os frontends
- `frontend/public/` site público
- `frontend/admin/` painel admin
- `docker-compose.yml` MySQL + app + Adminer

---

## 🔐 Rotas principais (API)
- `POST /api/auth/login`
- `GET /api/raffles`
- `POST /api/raffles`
- `GET /api/raffles/:id`
- `POST /api/raffles/:id/generate-tickets`
- `GET /api/raffles/:id/tickets`
- `PATCH /api/tickets/:id`
- `POST /api/raffles/:id/draw`
- `GET /api/raffles/:id/export.csv`
- `GET /api/raffles/:id/export.pdf`

---

## ✅ Dicas de VPS
- Abra portas 8080 (Docker) ou 3000 (Node).
- Use Nginx como proxy reverso se quiser domínio.

Boa! 👊
