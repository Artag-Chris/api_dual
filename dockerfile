# Usa una imagen base de Node.js en su versión 21-alpine3.19
FROM node:22

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia el archivo package.json y package-lock.json al directorio de trabajo
COPY package.json ./
COPY package-lock.json ./

# Copia los archivos de Prisma necesarios para el postinstall
COPY prisma ./prisma
COPY tsconfig.json ./

# Instala las dependencias del proyecto
RUN npm install 

# Copia el resto de los archivos del proyecto al directorio de trabajo
COPY . .

# Expone el puerto 35715
EXPOSE 6199

