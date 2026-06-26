FROM node:22-bookworm-slim

WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/Elsevier11/carra-order-management"
LABEL org.opencontainers.image.description="Backend API for Carra Consegne"

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3100

ENV RUN_DB_BOOTSTRAP=false

CMD ["npm", "run", "start"]
