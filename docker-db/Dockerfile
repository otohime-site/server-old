FROM postgres:10
RUN apt-get update && \
    apt-get install -y postgresql-contrib-10 postgresql-server-dev-10 pgxnclient ca-certificates build-essential &&\
    rm -rf /var/lib/apt/lists/*
RUN pgxn install temporal_tables
ADD ./init.sql /docker-entrypoint-initdb.d
