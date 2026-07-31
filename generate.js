/**
 * 每日内容生成主脚本
 *
 * 运行逻辑：
 * 1. 读取已有的 content/listening.json（历史累积文章）
 * 2. 生成当天新文章（默认 5 篇每日泛听 + 1 篇发音口语）
 * 3. 合并去重后写回 content/listening.json
 * 4. 同时生成 content/meta.json（记录最后更新时间、今日新增的分类）
 *
 * App 端只需拉取这两个 JSON 即可，无需服务器。
 *
 * 环境变量：
 *   GLM_API_KEY        —— 智谱 GLM API Key（必填）
 *   DAILY_DIALOGUE_COUNT —— 每日泛听生成篇数（默认 5）
 *   DAILY_PRON_COUNT   —— 每日发音口语生成篇数（默认 1）
 *   MAX_ARTICLES       —— 库中保留的最大文章数（默认 500，超出丢弃最旧的）
 */

const fs = require('fs');
const path = require('path');
const {
  generateDialogueArticle,
  generatePronunciationArticle,
  buildRotationList,
} = require('./generators');

const CONTENT_DIR = path.join(__dirname, 'content');
const LISTENING_FILE = path.join(CONTENT_DIR, 'listening.json');
const META_FILE = path.join(CONTENT_DIR, 'meta.json');

const DAILY_DIALOGUE_COUNT = parseInt(process.env.DAILY_DIALOGUE_COUNT || '5', 10);
const DAILY_PRON_COUNT = parseInt(process.env.DAILY_PRON_COUNT || '1', 10);
const MAX_ARTICLES = parseInt(process.env.MAX_ARTICLES || '500', 10);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 北京时间日期 yyyy-MM-dd
function beijingToday() {
  const bj = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return bj.toISOString().slice(0, 10);
}

// 北京时间 MM/DD 前缀
function datePrefix() {
  const bj = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${String(bj.getUTCMonth() + 1).padStart(2, '0')}/${String(bj.getUTCDate()).padStart(2, '0')}`;
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function main() {
  return (async () => {
    if (!process.env.GLM_API_KEY) {
      console.error('❌ 缺少 GLM_API_KEY 环境变量');
      process.exit(1);
    }

    fs.mkdirSync(CONTENT_DIR, { recursive: true });

    const store = readJSON(LISTENING_FILE, { articles: [], nextId: 1 });
    if (!Array.isArray(store.articles)) store.articles = [];
    if (!store.nextId) {
      store.nextId = store.articles.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1;
    }

    const today = beijingToday();
    const prefix = datePrefix();
    const newArticles = [];
    const updatedCategories = new Set(); // 供 meta 记录今日更新的分类

    // ---- 每日泛听（轮流覆盖不同 subTag）----
    const dialogueRotation = buildRotationList('每日泛听');
    // 用当天的 day-of-year 作为轮流起点，保证不同天覆盖不同场景
    const dayOfYear = Math.floor((Date.now() + 8 * 3600e3) / 86400e3);
    let idx = dayOfYear * DAILY_DIALOGUE_COUNT;

    for (let i = 0; i < DAILY_DIALOGUE_COUNT; i++) {
      const { tag, subTag } = dialogueRotation[idx % dialogueRotation.length];
      idx++;
      try {
        const data = await generateDialogueArticle(tag, subTag);
        if (data) {
          newArticles.push(finalize(data, store, prefix, today));
          updatedCategories.add(`${data.category}-${data.tag}`);
          console.log(`✅ 对话 ${tag}/${subTag} — "${data.title}"`);
        }
      } catch (err) {
        console.error(`⚠️ 对话 ${tag}/${subTag} 失败: ${err.message}`);
      }
      await sleep(2000);
    }

    // ---- 发音口语 ----
    const pronRotation = buildRotationList('发音口语');
    let pIdx = dayOfYear * DAILY_PRON_COUNT;
    for (let i = 0; i < DAILY_PRON_COUNT; i++) {
      const { tag, subTag } = pronRotation[pIdx % pronRotation.length];
      pIdx++;
      try {
        const data = await generatePronunciationArticle(tag, subTag);
        if (data) {
          newArticles.push(finalize(data, store, prefix, today));
          updatedCategories.add(`${data.category}-${data.tag}`);
          console.log(`✅ 发音 ${tag}/${subTag} — "${data.title}"`);
        }
      } catch (err) {
        console.error(`⚠️ 发音 ${tag}/${subTag} 失败: ${err.message}`);
      }
      await sleep(2000);
    }

    if (newArticles.length === 0) {
      console.error('❌ 今日未生成任何文章，退出（不覆盖已有内容）');
      process.exit(1);
    }

    // 新文章放最前面（App 端按 publishDate DESC 展示）
    store.articles = [...newArticles, ...store.articles];

    // 超出上限则丢弃最旧的
    if (store.articles.length > MAX_ARTICLES) {
      store.articles = store.articles.slice(0, MAX_ARTICLES);
    }

    fs.writeFileSync(LISTENING_FILE, JSON.stringify(store, null, 0));

    const meta = {
      lastUpdated: new Date().toISOString(),
      today,
      totalArticles: store.articles.length,
      todayAdded: newArticles.length,
      updatedCategories: Array.from(updatedCategories),
    };
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));

    console.log(`\n🎉 完成：今日新增 ${newArticles.length} 篇，库中共 ${store.articles.length} 篇`);
  })();
}

// 给生成的文章补齐 id / 标题日期前缀 / publishDate 字段
function finalize(data, store, prefix, today) {
  const id = store.nextId++;
  return {
    id,
    title: `${prefix} ${data.title}`,
    titleZh: data.titleZh ? `${prefix} ${data.titleZh}` : '',
    category: data.category,
    tag: data.tag,
    subTag: data.subTag || '',
    subTagIcon: data.subTagIcon || '',
    source: data.source || '',
    level: data.level || '中级',
    contentType: data.contentType || 'article',
    paragraphs: data.paragraphs || [],
    extraData: data.extraData || {},
    wordCount: data.wordCount || 0,
    coverIcon: data.coverIcon || 'headphones',
    coverColor: data.coverColor || '#667EEA',
    playCount: 0,
    publishDate: today,
  };
}

main().catch(err => {
  console.error('❌ 生成脚本异常:', err);
  process.exit(1);
});
