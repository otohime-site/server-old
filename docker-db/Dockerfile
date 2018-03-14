FROM postgres:10
RUN apt-get update && \
    apt-get install -y postgresql-contrib-10 postgresql-server-dev-10 pgxnclient ca-certificates build-essential &&\
    rm -rf /var/lib/apt/lists/*
RUN pgxn install temporal_tables
# Fix the config overwritten
RUN mv -v "/usr/share/postgresql/$PG_MAJOR/postgresql.conf.sample" /usr/share/postgresql/ \
	&& ln -sv ../postgresql.conf.sample "/usr/share/postgresql/$PG_MAJOR/" \
&& sed -ri "s!^#?(listen_addresses)\s*=\s*\S+.*!\1 = '*'!" /usr/share/postgresql/postgresql.conf.sample
ADD ./init.sql /docker-entrypoint-initdb.d
