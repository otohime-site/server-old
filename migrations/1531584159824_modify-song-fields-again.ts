import { MigrationBuilder } from 'node-pg-migrate'

exports.shorthands = undefined

export const up = (pgm: MigrationBuilder) => {
  pgm.addColumns('laundry_songs', {
    japan_only: { type: 'boolean', notNull: true, default: false },
    version: { type: 'real', notNull: false }
  })
  pgm.dropColumns('laundry_songs', ['full_raw_score'])
}

export const down = (pgm: MigrationBuilder) => {
  pgm.dropColumns('laundry_songs', ['japan_only', 'version'])
  pgm.addColumns('laundry_songs', {
    full_raw_score: { type: 'INTEGER[]', notNull: false }
  })
}
