FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

# Expose port (Hugging Face Spaces uses port 7860 by default)
EXPOSE 7860
ENV PORT=7860

CMD ["npm", "start"]
