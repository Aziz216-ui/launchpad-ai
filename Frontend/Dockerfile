# Image du Frontend LaunchPad AI (Angular, servi par Nginx).
# L'application appelle uniquement l'API Gateway (http://localhost:8090), voir src/environments/environment.ts.

# --- Étape 1 : compilation Angular ---------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

# --- Étape 2 : Nginx -----------------------------------------------------------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Angular (builder "application") produit dist/<projet>/browser
COPY --from=build /app/dist/launchpad-ai-frontend/browser /usr/share/nginx/html
EXPOSE 80
