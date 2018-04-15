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

CREATE TABLE "laundryPlayers" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname VARCHAR UNIQUE NOT NULL,
  privacy VARCHAR NOT NULL,
  "userId" uuid REFERENCES users (id) NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE "laundryRecords" (
  id uuid PRIMARY KEY,
  "cardName" VARCHAR NOT NULL,
  rating REAL NOT NULL,
  "maxRating" REAL NOT NULL,
  icon VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  period tstzrange NOT NULL,
  class VARCHAR NOT NULL,
  "laundryPlayerId" uuid REFERENCES "laundryPlayers" (id) NOT NULL
);

CREATE TABLE "laundryRecordRecents" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "laundryPlayerId" uuid REFERENCES "laundryPlayers" (id) NOT NULL
) INHERITS ("laundryRecords");

CREATE INDEX ON "laundryRecordRecents"("cardName");
CREATE INDEX ON "laundryRecordRecents"(rating);
CREATE INDEX ON "laundryRecordRecents"(class);

CREATE TABLE "laundryRecordHistories" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "laundryPlayerId" uuid REFERENCES "laundryPlayers" (id) NOT NULL
) INHERITS ("laundryRecords");

CREATE INDEX ON "laundryRecordRecents" USING GIST (period);
CREATE INDEX ON "laundryRecordHistories" USING GIST (period);

SELECT create_versioning_trigger('"laundryRecordRecents"', '"laundryRecordHistories"');
    `); 
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(`
DROP TABLE "laundryRecordRecents";
DROP TABLE "laundryRecordHistories";
DROP TABLE "laundryRecords";
DROP TABLE "laundryPlayers";
DROP FUNCTION IF EXISTS create_versioning_trigger(recent regclass, history regclass);

    `); 
  }
};
