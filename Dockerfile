FROM node:9-stretch
RUN curl -o- -L https://yarnpkg.com/install.sh | bash
RUN mkdir /app
ADD package.json /app
ADD yarn.lock /app
WORKDIR /app
RUN yarn install
ADD . /app
