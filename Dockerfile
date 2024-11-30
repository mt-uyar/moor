# Node.js imajını temel al
FROM node:18

# Uygulama dizinini oluştur
WORKDIR /usr/src/app

# package.json ve package-lock.json dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install

# Tüm proje dosyalarını kopyala
COPY . .

# 3000 portunu dışarı aç
EXPOSE 3000

# Uygulamayı başlat
CMD ["node", "app.js"]