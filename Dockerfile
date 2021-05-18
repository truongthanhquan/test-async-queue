FROM node:12

# Create Directory for the Container
WORKDIR /app

COPY package* .

# Install all package
RUN yarn

COPY rpc* .

EXPOSE 3000