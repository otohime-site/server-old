import { MigrationBuilder } from 'node-pg-migrate'

exports.shorthands = undefined

export const up = (pgm: MigrationBuilder) => {
  pgm.addColumns('laundry_songs', {
    active: { type: 'boolean', notNull: true, default: true },
    english_name: { type: 'varchar', notNull: false }
  })
}

export const down = (pgm: MigrationBuilder) => {
  pgm.dropColumns('laundry_songs', ['active', 'english_name'])
}
