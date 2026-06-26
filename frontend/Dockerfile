FROM node:22-bookworm-slim AS build

WORKDIR /app/frontend

LABEL org.opencontainers.image.source="https://github.com/Elsevier11/carra-order-management"
LABEL org.opencontainers.image.description="Frontend UI for Carra Consegne"

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
COPY src/shared /app/src/shared

RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist/carra-consegne-frontend/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
