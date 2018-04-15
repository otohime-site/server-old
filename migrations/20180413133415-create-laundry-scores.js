'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(`
CREATE TABLE "laundryScores" (
  id uuid PRIMARY KEY,
  category VARCHAR NOT NULL,
  "songName" VARCHAR NOT NULL,
  difficulty VARCHAR NOT NULL,
  score REAL NOT NULL,
  flag VARCHAR NOT NULL,
  period tstzrange NOT NULL,
  "laundryPlayerId" uuid REFERENCES "laundryPlayers" (id) NOT NULL
);
CREATE TABLE "laundryScoreRecents" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "laundryPlayerId" uuid REFERENCES "laundryPlayers" (id) NOT NULL,
  UNIQUE (category, "songName", "laundryPlayerId")
) INHERITS ("laundryScores");

CREATE TABLE "laundryScoreHistories" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "laundryPlayerId" uuid REFERENCES "laundryPlayers" (id) NOT NULL
) INHERITS ("laundryScores");

CREATE INDEX ON "laundryScoreRecents" USING GIST (period);
CREATE INDEX ON "laundryScoreHistories" USING GIST (period);
SELECT create_versioning_trigger('"laundryScoreRecents"', '"laundryScoreHistories"');
    `);
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(`
DROP TABLE "laundryScoreRecents";
DROP TABLE "laundryScoreHistories";
DROP TABLE "laundryScores";
    `); 
  }
};
