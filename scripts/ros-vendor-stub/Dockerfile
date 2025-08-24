FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm i
COPY index.js .
EXPOSE 5678
CMD ["node","index.js"]
