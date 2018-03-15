'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(`
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
  user_id uuid REFERENCES users (id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE laundry_records (
  id uuid PRIMARY KEY,
  card_name VARCHAR NOT NULL,
  rating REAL NOT NULL,
  max_rating REAL NOT NULL,
  icon VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  period tstzrange NOT NULL,
  player_id uuid REFERENCES laundry_players (id) NOT NULL
);

CREATE TABLE laundry_records_recent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES laundry_players (id) NOT NULL
) INHERITS (laundry_records);

CREATE TABLE laundry_records_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES laundry_players (id) NOT NULL
) INHERITS (laundry_records);

CREATE INDEX ON laundry_records_recent USING GIST (period);
CREATE INDEX ON laundry_records_history USING GIST (period);

SELECT create_versioning_trigger('laundry_records_recent', 'laundry_records_history');
    `); 
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(`
DROP TABLE laundry_records_recent;
DROP TABLE laundry_records_history;
DROP TABLE laundry_records;
DROP TABLE laundry_players;
DROP FUNCTION IF EXISTS create_versioning_trigger(recent regclass, history regclass);

    `); 
  }
};
