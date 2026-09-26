FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM nginx:1.27-alpine AS production

ENV NGINX_ENVSUBST_OUTPUT_DIR=/usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/runtime-config.js.template /etc/nginx/templates/runtime-config.js.template

EXPOSE 80
