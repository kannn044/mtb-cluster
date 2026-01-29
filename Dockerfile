# Dockerfile
FROM node:20

# Install git and pm2
RUN apt-get update && apt-get install -y git && npm install -g pm2

WORKDIR /app

# Clone frontend and build
RUN git clone https://github.com/kannn044/mtb-frontend.git mtb-frontend
WORKDIR /app/mtb-frontend
RUN npm install
RUN npm run build

WORKDIR /app

# Clone backend and build
RUN git clone https://github.com/kannn044/mtb-backend.git mtb-backend
WORKDIR /app/mtb-backend
RUN npm install
RUN npm run build

# Copy pm2 process files
WORKDIR /app
COPY process.frontend.json .
COPY process.backend.json .

# Expose ports
EXPOSE 3000 3001

# Default command
CMD ["pm2", "start", "process.frontend.json", "--no-daemon"]
