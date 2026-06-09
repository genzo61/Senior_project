FROM node:20-alpine AS build
WORKDIR /app/Garson_Customer_Frontend

COPY Garson_Customer_Frontend/package*.json ./
RUN npm ci

COPY Garson_Customer_Frontend ./
COPY images /app/images

ARG VITE_BACKEND_URL=
ARG VITE_AI_CHAT_ENDPOINT=
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ENV VITE_AI_CHAT_ENDPOINT=${VITE_AI_CHAT_ENDPOINT}

RUN npm run build

FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

COPY Garson_Customer_Frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/Garson_Customer_Frontend/dist /usr/share/nginx/html

EXPOSE 80
