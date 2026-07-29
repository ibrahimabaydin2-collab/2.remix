# Multi-stage Dockerfile for Cloud Run (Express + Vite)
# --- Derleme Aşaması (Build Stage) ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Çalışma Aşaması (Runner Stage) ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Sadece üretim ortamı bağımlılıklarını kurun
COPY package*.json ./
RUN npm ci --only=production

# Derlenen frontend ve backend dosyalarını kopyalayın
COPY --from=builder /app/dist ./dist

# Uygulama portunu dışa açın
EXPOSE 3000

# Uygulamayı başlatın
CMD ["node", "dist/server.cjs"]
