FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3100

ENV RUN_DB_BOOTSTRAP=false

CMD ["npm", "run", "start"]
