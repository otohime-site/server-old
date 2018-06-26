/* eslint-disable no-console */

const { Pool } = require('pg');
const fetch = require('node-fetch');
const encoding = require('encoding');
const Papa = require('papaparse');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Map category from maimai-log to maimai-net's.
const mailogCategories = {
  'POPS & アニメ': 'POPS ＆ アニメ',
  'niconico & ボーカロイド': 'niconico ＆ ボーカロイド™',
  東方Project: '東方Project',
  SEGA: 'SEGA',
  'ゲーム & バラエティ': 'ゲーム ＆ バラエティ',
  'オリジナル & ジョイポリス': 'オリジナル ＆ ジョイポリス',
};

// Fix the shift-jis convertion bug in maimai-log CSV.
const mailogNames = {
  'Daydream caf?': 'Daydream café',
  'クローバー?クラブ': 'クローバー♣クラブ',
  'I ?': 'I ♥',
  'L\'?pilogue': 'L\'épilogue',
  'Session High?': 'Session High⤴',
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
  console.log('Getting maimai-log data...');
  const mailogRes = await fetch('https://maimai-log.net/database/music?m=csv');
  const mailogText = encoding.convert(await mailogRes.buffer(), 'utf-8', 'shift-jis').toString('utf-8');
  const mailogData = Papa.parse(mailogText, { header: true }).data;

  let count = 0;
  for (let i = 0; i < mailogData.length; i += 1) {
    const mailogSong = mailogData[i];
    const category = mailogCategories[mailogSong['カテゴリ']];
    let name = mailogSong['タイトル'];
    if (name in mailogNames) {
      name = mailogNames[name];
    }
    if (category && name) {
      if (!songMap.has(`${category}-${name}`)) {
        console.log(`Cannot find "${category}" "${name}"! Please manually correct!`);
      } else {
        const song = songMap.get(`${category}-${name}`);
        const hasReMaster = (mailogSong['Re:Master(Lv)'] !== '');
        if (hasReMaster) {
          song.levels = [
            mailogSong['Easy(Lv)'],
            mailogSong['Basic(Lv)'],
            mailogSong['Advenced(Lv)'],
            mailogSong['Expert(Lv)'],
            mailogSong['Master(Lv)'],
            mailogSong['Re:Master(Lv)'],
          ];
        } else {
          song.levels = [
            mailogSong['Easy(Lv)'],
            mailogSong['Basic(Lv)'],
            mailogSong['Advenced(Lv)'],
            mailogSong['Expert(Lv)'],
            mailogSong['Master(Lv)'],
          ];
        }
        count += 1;
      }
    }
  }
  console.log(`${count} songs from maimai-log has been imported!`);

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
        text: `UPDATE laundry_songs SET levels = $2, english_name = $3
               WHERE id = $1;`,
        values: [song.id, song.levels, song.english_name],
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
