FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3100

CMD ["sh", "-c", "npm run db:migrate && npm run start"]
