import { MigrationBuilder } from 'node-pg-migrate'

export const shorthands = undefined

export const up = (pgm: MigrationBuilder) => {
  pgm.createTable('laundry_dx_players', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    nickname: { type: 'varchar', unique: true, notNull: true },
    privacy: { type: 'varchar', notNull: true },
    user_id: { type: 'uuid', references: 'users (id)', notNull: true }
  })
  pgm.createTable('laundry_dx_songs', {
    id: 'id',
    seq: { type: 'smallint', notNull: true },
    deluxe: { type: 'boolean', notNull: true, default: false },
    category: { type: 'varchar', notNull: true },
    name: { type: 'varchar', notNull: true },
    levels: { type: 'varchar(3)[]' },
    active: { type: 'boolean', notNull: true, default: true },
    version: { type: 'real', notNull: false },
    english_name: { type: 'varchar', notNull: false },
    japan_only: { type: 'boolean', notNull: true, default: false }
  }, {
    constraints: {
      unique: ['category', 'name', 'deluxe']
    }
  })

  pgm.createTable('laundry_dx_records_recent', {
    card_name: { type: 'varchar', notNull: true },
    rating: { type: 'integer', notNull: true },
    max_rating: { type: 'integer', notNull: true },
    title: { type: 'varchar', notNull: true },
    period: { type: 'tstzrange', notNull: true },
    class: { type: 'varchar', notNull: true },
    player_id: { type: 'uuid', references: 'laundry_dx_players (id)', unique: true, notNull: true }
  })
  pgm.createIndex('laundry_dx_records_recent', 'card_name')
  pgm.createIndex('laundry_dx_records_recent', 'rating')
  pgm.createIndex('laundry_dx_records_recent', 'class')

  pgm.createTable('laundry_dx_records_history', {}, {
    like: {
      table: 'laundry_dx_records_recent'
    },
    constraints: {
      foreignKeys: {
        columns: 'player_id',
        references: 'laundry_dx_players (id)'
      }
    }
  })

  pgm.sql(`SELECT create_versioning_trigger('laundry_dx_records_recent', 'laundry_dx_records_history');`)

  pgm.createTable('laundry_dx_scores_recent', {
    difficulty: { type: 'smallint', notNull: true },
    song_id: { type: 'integer', references: 'laundry_dx_songs (id)', notNull: true },
    score: { type: 'real', notNull: true },
    flag: { type: 'varchar', notNull: true },
    period: { type: 'tstzrange', notNull: true },
    player_id: { type: 'uuid', references: 'laundry_dx_players (id)', notNull: true }
  }, {
    constraints: {
      unique: ['song_id', 'difficulty', 'player_id']
    }
  })
  pgm.createTable('laundry_dx_scores_history', {}, {
    like: {
      table: 'laundry_dx_scores_recent'
    },
    constraints: {
      foreignKeys: [{
        columns: 'player_id',
        references: 'laundry_dx_players (id)'
      },{
        columns: 'song_id',
        references: 'laundry_dx_songs (id)'
      }]
    }
  })

  pgm.sql(`SELECT create_versioning_trigger('laundry_dx_scores_recent', 'laundry_dx_scores_history');`)

}

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable('laundry_dx_scores_history')
  pgm.dropTable('laundry_dx_scores_recent')
  pgm.dropTable('laundry_dx_records_history')
  pgm.dropTable('laundry_dx_records_recent')
  pgm.dropTable('laundry_dx_songs')
  pgm.dropTable('laundry_dx_players')
}
