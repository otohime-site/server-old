/* eslint-disable no-console */

const { Pool } = require('pg');
const fetch = require('node-fetch');
const Papa = require('papaparse');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Map category from maimai-log to maimai-net's.
const categoryFromJson = {
  'POPS＆アニメ': 'POPS ＆ アニメ',
  'niconico & ボーカロイド': 'niconico ＆ ボーカロイド™',
  東方Project: '東方Project',
  SEGA: 'SEGA',
  'ゲーム & バラエティ': 'ゲーム ＆ バラエティ',
  'オリジナル & ジョイポリス': 'オリジナル ＆ ジョイポリス',
};

// Mapping JSON names to score list names.
const officialNames = {
  'Yet Another ”drizzly rain” ': 'Yet Another ”drizzly rain”',
  'Pursuing My True Self ': 'Pursuing My True Self',
  'D✪N’T  ST✪P  R✪CKIN’': 'DON’T  STOP  ROCKIN’',
};

async function main() {
  const queryResult = await pool.query('SELECT * FROM laundry_songs ORDER BY seq ASC;');
  const songMap = new Map();
  let activeCount = 0;
  let inactiveCount = 0;
  for (let i = 0; i < queryResult.rows.length; i += 1) {
    const song = queryResult.rows[i];
    songMap.set(`${song.category}-${song.name}`, song);
    if (song.active) {
      activeCount += 1;
    } else {
      inactiveCount += 1;
    }
  }
  console.log(`Read from databases: ${activeCount} active, ${inactiveCount} inactive.`);

  // Get data from maimai-log.
  console.log('Getting official maimai JSON files...');
  const maiJsonRes = await fetch('https://maimai.sega.jp/data/songs.json');
  const maiJson = await maiJsonRes.json();

  let count = 0;
  for (let i = 0; i < maiJson.length; i += 1) {
    const maiJsonSong = maiJson[i];
    const category = categoryFromJson[maiJsonSong.category];
    let name = maiJsonSong.title;
    if (name in officialNames) {
      name = officialNames[name];
    }
    // category === 'enkai' will be filtereed out here.
    if (category && name) {
      if (!songMap.has(`${category}-${name}`)) {
        console.log(`Cannot find "${category}" "${name}"!`);
      } else {
        const song = songMap.get(`${category}-${name}`);
        song.levels = [
          maiJsonSong.lev_eas,
          maiJsonSong.lev_bas,
          maiJsonSong.lev_adv,
          maiJsonSong.lev_exp,
          maiJsonSong.lev_mas,
        ];
        const hasReMaster = (maiJsonSong.lev_remas !== ' ');
        if (hasReMaster) {
          song.levels.push(maiJsonSong.lev_remas);
        }
        song.version = 7; // Assume all new song is FiNALE
        count += 1;
      }
    }
  }
  console.log(`${count} songs from official JSON has been imported!`);

  count = 0;
  let japanOnlyCount = 0;
  // Get data from overseas CSV.
  console.log('Getting overseas data...');
  const overseasRes = await fetch('https://raw.githubusercontent.com/semiquaver-moe/data/master/maimai/overseas.csv');
  const overseasData = Papa.parse(await overseasRes.text(), { header: true }).data;
  for (let i = 0; i < overseasData.length; i += 1) {
    const overseasSong = overseasData[i];
    const { category, name } = overseasSong;
    if (category && name) {
      if (!songMap.has(`${category}-${name}`)) {
        console.log(`Cannot find "${category}" "${name}"! Please manually correct!`);
      } else {
        const song = songMap.get(`${category}-${name}`);
        song.english_name = overseasSong.english_name;
        song.japan_only = (overseasSong.japan_only.trim() === 'Y');
        song.version = parseFloat(overseasSong.version) || null;
        song.active = (overseasSong.inactive.trim() !== 'Y');
        if (song.japan_only) {
          japanOnlyCount += 1;
        }
        count += 1;
      }
    }
  }
  console.log(`${count} songs (${japanOnlyCount} marked Japan only) from overseas CSV has been imported!`);
  console.log('Writting into database...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const promises = [];
    songMap.forEach((song) => {
      const songQuery = {
        name: 'update-songs',
        text: `UPDATE laundry_songs SET levels = $2, english_name = $3, version = $4, active = $5
               WHERE id = $1;`,
        values: [song.id, song.levels, song.english_name, song.version, song.active],
      };
      promises.push(client.query(songQuery));
    });
    await Promise.all(promises);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main().then(() => { process.exit(); });
