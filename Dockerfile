# First stage: build the application
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN yarn install

# Copy the source from the current directory to the working directory inside the container
COPY . .

# Build the application
# RUN yarn build
# TEMP: Currently an error in the Bundlr package causes a build error however the JS files are still generated
# So we run yarn build locally and then copy the dist folder as a temporary fix
COPY dist /app/dist

# Expose port
EXPOSE 50052

# Command to run the application
CMD ["node", "dist/index.js"]

