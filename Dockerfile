FROM node:12-stretch
RUN curl -o- -L https://yarnpkg.com/install.sh | bash
RUN yarn global add pm2
RUN mkdir /app
ADD package.json /app
ADD yarn.lock /app
WORKDIR /app
RUN yarn install
ADD . /app
RUN yarn tsc
CMD ["pm2-runtime", "./build/index.js", "-i", "4"]
