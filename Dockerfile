FROM node:20-slim AS base

# Install Python 3, pip, and build tools for native SQLite bindings
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install all Node dependencies (including build tools for Vite & tsx)
COPY package.json package-lock.json ./
RUN npm ci

# Install Python dependencies for ReportLab PDF & Audit Logger
COPY document_engine/requirements.txt /tmp/pdf-requirements.txt
COPY backend/audit/requirements.txt /tmp/audit-requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages \
    -r /tmp/pdf-requirements.txt \
    -r /tmp/audit-requirements.txt

# Copy application code
COPY . .

# Seed database to ensure 1,000 records are indexed into SQLite
RUN npx tsx backend/seed.ts

# Build the frontend production bundle (Vite -> /dist)
RUN npm run build

# Expose Railway default PORT
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Start all 3 integrated services
CMD ["./run-integrated.sh"]
