/**
 * 一次性迁移脚本：把旧 sayhi-server 的 SQLite 听力文章
 * 导出并合并进新方案的 content/listening.json
 *
 * 旧库是早期表结构（无 sub_tag），这里为缺失的 subTag 做智能补全，
 * 避免导入后在 App 三级分类里显示异常。
 *
 * 用法：node migrate-old-db.js <旧db路径> <目标listening.json路径>
 */

const fs = require('fs');
const { execSync } = require('child_process');

const dbPath = process.argv[2];
const targetJson = process.argv[3];

if (!dbPath || !targetJson) {
  console.error('用法: node migrate-old-db.js <db路径> <listening.json路径>');
  process.exit(1);
}

// 用 sqlite3 CLI 导出为 JSON
const raw = execSync(
  `sqlite3 "${dbPath}" "SELECT id,title,title_zh,category,tag,source,level,content_type,paragraphs,extra_data,word_count,cover_icon,cover_color,play_count,publish_date FROM listening_articles;" -json`,
  { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
);
const oldRows = JSON.parse(raw || '[]');

// 为旧数据补全 subTag（旧库没有三级分类）
// 考试类用 tag+年份/名称，泛听/发音类给一个默认归档 subTag
function inferSubTag(row) {
  const { category, tag } = row;
  if (category === '英语考试') {
    const map = {
      '四级': '2024四级听力真题', '六级': '2024六级听力真题',
      '雅思': '剑桥雅思18听力', '托福': 'TPO70-74', '考研': '2024考研英语听力',
    };
    return map[tag] || `${tag}真题`;
  }
  if (category === '每日泛听') {
    const map = { '日常对话': '咖啡厅', '职场英语': '会议', '旅行场景': '机场' };
    return map[tag] || '其他';
  }
  if (category === '发音口语') {
    const map = { '音标发音': '元音', '连读技巧': '连读' };
    return map[tag] || '其他';
  }
  return '其他';
}

function inferSubTagIcon(row) {
  const icons = {
    '2024四级听力真题': '📝', '2024六级听力真题': '📝', '剑桥雅思18听力': '📋',
    'TPO70-74': '📚', '2024考研英语听力': '📘',
    '咖啡厅': '☕', '会议': '📊', '机场': '✈️', '元音': '🔤', '连读': '🔗',
  };
  return icons[inferSubTag(row)] || '📄';
}

function safeParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

// 读目标 JSON
const store = safeParse(fs.readFileSync(targetJson, 'utf8'), { articles: [], nextId: 1 });
if (!Array.isArray(store.articles)) store.articles = [];
if (!store.nextId) store.nextId = 1;

// 去重：以 title 判断（避免重复导入）
const existingTitles = new Set(store.articles.map(a => a.title));

let added = 0;
const migrated = [];
for (const r of oldRows) {
  if (existingTitles.has(r.title)) continue;
  migrated.push({
    id: store.nextId++,
    title: r.title || '',
    titleZh: r.title_zh || '',
    category: r.category || '每日泛听',
    tag: r.tag || '',
    subTag: inferSubTag(r),
    subTagIcon: inferSubTagIcon(r),
    source: r.source || '',
    level: r.level || '中级',
    contentType: r.content_type || 'article',
    paragraphs: safeParse(r.paragraphs, []),
    extraData: safeParse(r.extra_data, {}),
    wordCount: r.word_count || 0,
    coverIcon: r.cover_icon || 'headphones',
    coverColor: r.cover_color || '#667EEA',
    playCount: r.play_count || 0,
    publishDate: r.publish_date || new Date().toISOString().slice(0, 10),
  });
  added++;
}

// 旧内容追加到末尾（新内容保持在前）
store.articles = [...store.articles, ...migrated];

fs.writeFileSync(targetJson, JSON.stringify(store, null, 0));
console.log(`✅ 迁移完成：新增 ${added} 篇（跳过重复），库中共 ${store.articles.length} 篇`);
console.log('迁移的文章：');
migrated.forEach(a => console.log(`  [${a.category}/${a.tag}/${a.subTag}] ${a.title}`));
