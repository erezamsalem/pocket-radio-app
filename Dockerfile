# Use an official Node.js runtime as a parent image.
# The 'alpine' version is a lightweight Linux distribution.
FROM node:20-alpine

# Set the working directory in the container to /app
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory.
# The asterisk (*) is a wildcard that matches both files.
COPY package*.json ./

# Install application dependencies using 'npm ci' which is optimized for automated builds.
# '--only=production' ensures only production dependencies are installed, keeping the image small.
RUN npm ci --only=production

# Copy the rest of your application source code from your host to your image filesystem.
COPY . .

# Your app listens on port 3001, so we document that here.
EXPOSE 3001

# Define the command to run your app using CMD which defines your runtime.
CMD [ "node", "server.js" ]