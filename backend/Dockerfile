FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
# Copia frontend
COPY ../frontend /frontend
EXPOSE 3000
CMD ["node", "server.js"]
