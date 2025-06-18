# ---- Stage 1: Build ----
# Use an official Node.js image as a parent image. 'alpine' is a lightweight version.
FROM node:18-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or npm-shrinkwrap.json)
COPY package*.json ./

# Install all dependencies, including devDependencies for building
RUN npm install

# Copy the rest of your app's source code
COPY . .

RUN ls -la

# Compile TypeScript to JavaScript
RUN npm run build

# ---- Stage 2: Production ----
# Use a smaller, clean Node.js image for the final image
FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json again
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the built application from the 'builder' stage
COPY --from=builder /app/dist ./dist

# Copy the public assets
COPY --from=builder /app/public ./public

# The app needs a 'db' directory to create the sqlite file in.
# We create it here and set permissions. The volume will mount over this.
RUN mkdir -p db && chown -R node:node .

# Switch to a non-root user for security
USER node

# Expose the port the app runs on (as updated by you)
EXPOSE 3333

# The command to run the application
CMD [ "npm", "run", "prod" ]