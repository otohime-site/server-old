import { MigrationBuilder } from 'node-pg-migrate'

exports.shorthands = undefined

export const up = (pgm: MigrationBuilder) => {
  pgm.sql(`
CREATE OR REPLACE FUNCTION create_versioning_trigger(recent regclass, history regclass) RETURNS void AS
$$
BEGIN
EXECUTE format('CREATE TRIGGER versioning_cd BEFORE INSERT OR DELETE ON %s FOR EACH ROW EXECUTE PROCEDURE versioning(%I, %s, true)',
               recent, 'period', history);
EXECUTE format('CREATE TRIGGER versioning_up BEFORE UPDATE ON %s FOR EACH ROW WHEN ((OLD.*) IS DISTINCT FROM (NEW.*)) EXECUTE PROCEDURE versioning(%I, %s, true)',
               recent, 'period', history);
END
$$ LANGUAGE plpgsql;

CREATE TABLE laundry_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname VARCHAR UNIQUE NOT NULL,
  privacy VARCHAR NOT NULL,
  user_id uuid REFERENCES users (id) NOT NULL
);

CREATE TABLE laundry_records (
  card_name VARCHAR NOT NULL,
  rating REAL NOT NULL,
  max_rating REAL NOT NULL,
  icon VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  period tstzrange NOT NULL,
  class VARCHAR NOT NULL,
  player_id uuid REFERENCES laundry_players (id) NOT NULL
);

CREATE TABLE laundry_records_recent (
  player_id uuid REFERENCES laundry_players (id) UNIQUE NOT NULL
) INHERITS (laundry_records);

CREATE INDEX ON laundry_records_recent(card_name);
CREATE INDEX ON laundry_records_recent(rating);
CREATE INDEX ON laundry_records_recent(class);

CREATE TABLE laundry_records_history (
  player_id uuid REFERENCES laundry_players (id) NOT NULL
) INHERITS (laundry_records);

CREATE INDEX ON laundry_records_recent USING GIST (period);
CREATE INDEX ON laundry_records_history USING GIST (period);

SELECT create_versioning_trigger('laundry_records_recent', 'laundry_records_history');

CREATE TABLE laundry_songs (
  id SMALLINT PRIMARY KEY,
  seq SMALLINT NOT NULL,
  category VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  levels VARCHAR(3)[],
  full_raw_score INTEGER[]
);

CREATE TABLE laundry_scores (
  difficulty SMALLINT NOT NULL,
  song_id SMALLINT REFERENCES laundry_songs (id) NOT NULL,
  score REAL NOT NULL,
  raw_score INTEGER NOT NULL,
  flag VARCHAR NOT NULL,
  period tstzrange NOT NULL,
  player_id uuid REFERENCES laundry_players (id) NOT NULL
);
CREATE TABLE laundry_scores_recent (
  player_id uuid REFERENCES laundry_players (id) NOT NULL,
  UNIQUE (song_id, difficulty, player_id)
) INHERITS (laundry_scores);

CREATE TABLE laundry_scores_history (
  player_id uuid REFERENCES laundry_players (id) NOT NULL
) INHERITS (laundry_scores);

CREATE INDEX ON laundry_scores_recent USING GIST (period);
CREATE INDEX ON laundry_scores_history USING GIST (period);
SELECT create_versioning_trigger('laundry_scores_recent', 'laundry_scores_history');
  `);
};

export const down = (pgm: MigrationBuilder) => {
  pgm.sql(`
DROP TABLE laundry_scores_recent;
DROP TABLE laundry_scores_history;
DROP TABLE laundry_scores;
DROP TABLE laundry_songs;
DROP TABLE laundry_records_recent;
DROP TABLE laundry_records_history;
DROP TABLE laundry_records;
DROP TABLE laundry_players;
DROP FUNCTION IF EXISTS create_versioning_trigger(recent regclass, history regclass);
  `);
};
