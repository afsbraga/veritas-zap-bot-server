# Usa uma imagem oficial do Node bem leve
FROM node:18-bullseye-slim

# Instala o navegador Chromium e as dependências de sistema que o WhatsApp Web exige
RUN apt-get update && apt-get install -y \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Define onde o código vai morar dentro do container
WORKDIR /app

# Copia os arquivos de configuração do Node
COPY package*.json ./

# Instala as suas dependências (axios, whatsapp-web.js, form-data, etc)
RUN npm install

# Copia o resto do seu código
COPY . .

# Inicia o bot
CMD ["node", "index.js"]