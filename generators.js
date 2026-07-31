/**
 * 听力内容生成器 —— 4 级分类结构
 * category(一级) → tag(二级) → subTag(三级) → 文章(四级)
 *
 * 从原 sayhi-server 的 listeningGenerators.js 移植而来，
 * 去掉了数据库依赖，纯函数返回文章对象，供 GitHub Actions 脚本生成静态 JSON。
 */

const https = require('https');

const GLM_API_KEY = process.env.GLM_API_KEY || '';

// ============================
// 完整的 4 级分类配置
// ============================

const CATEGORY_TREE = {
  '每日泛听': {
    '日常对话': [
      { subTag: '咖啡厅', icon: '☕', topics: ['ordering coffee and chatting with the barista', 'running into an old friend at a coffee shop', 'studying and asking someone to watch your seat', 'complaining about a wrong order at a cafe'] },
      { subTag: '超市购物', icon: '🛒', topics: ['asking a store clerk where to find an item', 'returning a defective product', 'comparing prices with a friend while shopping', 'using self-checkout for the first time'] },
      { subTag: '邻里聊天', icon: '🏠', topics: ['introducing yourself to a new neighbor', 'asking a neighbor to keep the noise down', 'borrowing something from a neighbor', 'chatting about the weather and weekend plans'] },
      { subTag: '看病就医', icon: '🏥', topics: ['describing symptoms to a doctor', 'making an appointment at a clinic by phone', 'picking up a prescription at a pharmacy', 'asking the doctor about side effects of medicine'] },
      { subTag: '银行办事', icon: '🏦', topics: ['opening a new bank account', 'reporting a lost credit card', 'asking about exchange rates', 'applying for a loan at the bank'] },
    ],
    '职场英语': [
      { subTag: '面试', icon: '💼', topics: ['a job interview for a software engineer position', 'answering behavioral interview questions', 'negotiating salary and benefits', 'asking the interviewer questions about company culture'] },
      { subTag: '会议', icon: '📊', topics: ['presenting quarterly results to the team', 'brainstorming marketing ideas in a meeting', 'disagreeing politely with a colleague in a meeting', 'assigning tasks after a project kickoff meeting'] },
      { subTag: '同事闲聊', icon: '💬', topics: ['chatting with a coworker about weekend plans', 'discussing a new company policy at lunch', 'welcoming a new team member', 'talking about a team outing plan'] },
      { subTag: '电话沟通', icon: '📞', topics: ['scheduling a meeting over the phone', 'handling a customer complaint call', 'following up on an email by phone', 'leaving a professional voicemail'] },
    ],
    '旅行场景': [
      { subTag: '机场', icon: '✈️', topics: ['checking in at the airport counter', 'going through security and customs', 'dealing with a flight delay announcement', 'reporting lost luggage at baggage claim'] },
      { subTag: '酒店', icon: '🏨', topics: ['checking in at a hotel front desk', 'requesting extra towels and room service', 'complaining about a noisy room', 'checking out and asking for a receipt'] },
      { subTag: '餐厅点餐', icon: '🍽️', topics: ['ordering food and asking about specials', 'sending back a wrong order politely', 'asking for dietary restrictions and allergies', 'splitting the bill with friends'] },
      { subTag: '问路交通', icon: '🚌', topics: ['asking a local for directions to a museum', 'buying a metro ticket from a machine', 'taking a taxi and giving the destination', 'renting a car and asking about insurance'] },
    ],
  },
  '英语考试': {
    '四级': [
      { subTag: '2025四级听力真题', icon: '📝' },
      { subTag: '2024四级听力真题', icon: '📝' },
      { subTag: '2023四级听力真题', icon: '📝' },
    ],
    '六级': [
      { subTag: '2025六级听力真题', icon: '📝' },
      { subTag: '2024六级听力真题', icon: '📝' },
      { subTag: '2023六级听力真题', icon: '📝' },
    ],
    '雅思': [
      { subTag: '剑桥雅思18听力', icon: '📋' },
      { subTag: '剑桥雅思17听力', icon: '📋' },
      { subTag: '剑桥雅思16听力', icon: '📋' },
    ],
    '托福': [
      { subTag: 'TPO70-74', icon: '📚' },
      { subTag: 'TPO65-69', icon: '📚' },
      { subTag: 'TPO60-64', icon: '📚' },
    ],
    '考研': [
      { subTag: '2025考研英语听力', icon: '📘' },
      { subTag: '2024考研英语听力', icon: '📘' },
      { subTag: '2023考研英语听力', icon: '📘' },
    ],
  },
  '发音口语': {
    '音标发音': [
      { subTag: '元音', icon: '🔤', topics: ['short vowel /ɪ/ vs long vowel /iː/ (sit vs seat)', 'the schwa /ə/ — the most common English vowel sound', 'vowel /æ/ vs /e/ (cat vs bed)', 'vowel /ʌ/ vs /ɑː/ (cup vs car)'] },
      { subTag: '辅音', icon: '🗣️', topics: ['the /θ/ and /ð/ th-sounds (think vs this)', 'the /r/ and /l/ sounds — common difficulty for Chinese speakers', 'the /ŋ/ nasal sound (sing, think, ring)', 'the /v/ and /w/ sounds (very vs well)'] },
      { subTag: '双元音', icon: '🎵', topics: ['diphthongs /aɪ/ /eɪ/ /ɔɪ/ (my, day, boy)', 'diphthongs /aʊ/ /əʊ/ (how, go)', 'diphthong /ɪə/ /eə/ /ʊə/ (here, there, sure)'] },
    ],
    '连读技巧': [
      { subTag: '连读', icon: '🔗', topics: ['linking consonant to vowel (turn off → tur-noff)', 'linking with intrusive /r/ (idea of → idea-rof)', 'linking vowel to vowel with /w/ and /j/ (do it → do-wit)'] },
      { subTag: '弱读', icon: '🔉', topics: ['weak forms of common words (to, for, of, and, can, have)', 'strong vs weak forms in sentences', 'reducing function words in natural speech'] },
      { subTag: '同化省音', icon: '✂️', topics: ['assimilation: sounds changing to match neighbors (ten people → tem people)', 'elision: dropping consonants (last night → las night)', 'contractions in natural speech (I would have → I wouldve)'] },
    ],
  },
};

// ============================
// 1. 每日泛听 —— AI 生成场景对话
// ============================

async function generateDialogueArticle(tag, subTag, topicOverride) {
  if (!GLM_API_KEY) throw new Error('缺少 GLM_API_KEY');

  const catTree = CATEGORY_TREE['每日泛听'];
  const tagGroup = catTree[tag];
  if (!tagGroup) return null;

  let subGroup = tagGroup.find(s => s.subTag === subTag);
  if (!subGroup) subGroup = tagGroup[Math.floor(Math.random() * tagGroup.length)];

  const topic = topicOverride || subGroup.topics[Math.floor(Math.random() * subGroup.topics.length)];

  const prompt = `Generate a realistic English dialogue for Chinese English learners.

Scenario: ${topic}

Requirements:
1. Two speakers with real English names
2. 8-12 turns of natural conversation
3. B1-B2 level English, natural and colloquial
4. Include common phrases and expressions
5. Each line must have English content and Chinese translation

RESPOND WITH VALID JSON ONLY:
{
  "title": "A short descriptive English title",
  "titleZh": "中文标题",
  "speakers": ["Name1", "Name2"],
  "lines": [
    {"speaker": "Name1", "en": "English sentence", "zh": "中文翻译"},
    {"speaker": "Name2", "en": "English reply", "zh": "中文翻译"}
  ],
  "keyPhrases": [
    {"phrase": "useful phrase", "meaning": "中文释义"}
  ]
}`;

  const result = await callGLM(prompt, 0.85);
  const data = JSON.parse(result);

  const paragraphs = data.lines.map(l => ({
    en: `${l.speaker}: ${l.en}`,
    zh: `${l.speaker}: ${l.zh}`,
  }));
  const wordCount = data.lines.map(l => l.en).join(' ').split(/\s+/).length;

  const tagIcons = { '日常对话': 'bubble.left.and.bubble.right.fill', '职场英语': 'briefcase.fill', '旅行场景': 'airplane' };
  const tagColors = { '日常对话': '#667EEA', '职场英语': '#4FACFE', '旅行场景': '#43E97B' };

  return {
    title: data.title,
    titleZh: data.titleZh || '',
    category: '每日泛听',
    tag,
    subTag: subGroup.subTag,
    subTagIcon: subGroup.icon,
    contentType: 'dialogue',
    level: '中级',
    paragraphs,
    extraData: {
      speakers: data.speakers,
      lines: data.lines,
      keyPhrases: data.keyPhrases || [],
      scenario: topic,
    },
    wordCount,
    source: 'AI Dialogue',
    coverIcon: tagIcons[tag] || 'bubble.left.and.bubble.right.fill',
    coverColor: tagColors[tag] || '#667EEA',
  };
}

// ============================
// 2. 英语考试 —— AI 生成模拟题
// ============================

async function generateExamArticle(tag, subTag, topicOverride) {
  if (!GLM_API_KEY) throw new Error('缺少 GLM_API_KEY');

  const catTree = CATEGORY_TREE['英语考试'];
  const tagGroup = catTree[tag];
  if (!tagGroup) return null;

  let subGroup = tagGroup.find(s => s.subTag === subTag);
  if (!subGroup) subGroup = tagGroup[Math.floor(Math.random() * tagGroup.length)];

  const topic = topicOverride || (subGroup.topics ? subGroup.topics[Math.floor(Math.random() * subGroup.topics.length)] : `A ${tag} listening test about ${subTag}`);

  const levelMap = { '雅思': 'C1', '托福': 'C1', '四级': 'B1-B2', '六级': 'B2-C1', '考研': 'B2-C1' };

  const prompt = `Generate a realistic ${tag} listening test item for Chinese English learners.

Topic/Scenario: ${topic}
Section: ${subTag}
Difficulty: ${levelMap[tag] || 'B2'} level

Requirements:
1. Write a realistic listening transcript (200-400 words)
2. Create 4-5 multiple choice questions based on the transcript
3. Each question has 4 options (A, B, C, D)
4. Provide the correct answer and brief Chinese explanation
5. Include Chinese translation for the transcript

RESPOND WITH VALID JSON ONLY:
{
  "title": "English title",
  "titleZh": "中文标题",
  "audioText": "Full listening transcript text...",
  "paragraphs": [
    {"en": "English paragraph", "zh": "中文翻译"}
  ],
  "questions": [
    {"id": 1, "question": "Question text?", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "B", "explanation": "中文解析"}
  ]
}`;

  const result = await callGLM(prompt, 0.6);
  const data = JSON.parse(result);
  const wordCount = (data.audioText || '').split(/\s+/).length;

  const examColors = { '雅思': '#FF9500', '托福': '#5856D6', '四级': '#34C759', '六级': '#007AFF', '考研': '#FF3B30' };
  const examIcons = { '雅思': 'doc.text.magnifyingglass', '托福': 'globe.americas.fill', '四级': 'graduationcap.fill', '六级': 'graduationcap.fill', '考研': 'book.fill' };

  return {
    title: data.title,
    titleZh: data.titleZh || `${tag} ${subTag} 模拟题`,
    category: '英语考试',
    tag,
    subTag: subGroup.subTag,
    subTagIcon: subGroup.icon,
    contentType: 'exam',
    level: ['雅思', '托福'].includes(tag) ? '高级' : '中级',
    paragraphs: data.paragraphs || [],
    extraData: {
      exam: tag,
      questions: data.questions || [],
      audioText: data.audioText || '',
    },
    wordCount,
    source: `${tag}模拟题`,
    coverIcon: examIcons[tag] || 'doc.text.fill',
    coverColor: examColors[tag] || '#667EEA',
  };
}

// ============================
// 3. 发音口语 —— AI 生成教学内容
// ============================

async function generatePronunciationArticle(tag, subTag, topicOverride) {
  if (!GLM_API_KEY) throw new Error('缺少 GLM_API_KEY');

  const catTree = CATEGORY_TREE['发音口语'];
  const tagGroup = catTree[tag];
  if (!tagGroup) return null;

  let subGroup = tagGroup.find(s => s.subTag === subTag);
  if (!subGroup) subGroup = tagGroup[Math.floor(Math.random() * tagGroup.length)];

  const topic = topicOverride || subGroup.topics[Math.floor(Math.random() * subGroup.topics.length)];

  const prompt = `Create an English pronunciation lesson for Chinese learners about: ${topic}

Requirements:
1. Clear explanation in Chinese
2. 5-8 example words with phonetic transcription
3. 3-5 practice sentences
4. Common mistakes Chinese speakers make
5. Tips for improvement

RESPOND WITH VALID JSON ONLY:
{
  "title": "English title",
  "titleZh": "中文标题",
  "explanation": "用中文详细解释这个发音规则/技巧，2-3段",
  "examples": [
    {"word": "seat", "phonetic": "/siːt/", "zh": "座位"}
  ],
  "practiceSentences": [
    {"en": "Please take a seat.", "zh": "请坐。", "focus": "seat /siːt/"}
  ],
  "commonMistakes": "中文说明常见错误",
  "tips": "中文改进建议"
}`;

  const result = await callGLM(prompt, 0.5);
  const data = JSON.parse(result);

  const paragraphs = [];
  paragraphs.push({ en: topic, zh: data.explanation });
  const exEn = data.examples.map(e => `${e.word} ${e.phonetic}`).join('  |  ');
  const exZh = data.examples.map(e => `${e.word} ${e.phonetic} — ${e.zh}`).join('\n');
  paragraphs.push({ en: exEn, zh: exZh });
  for (const s of (data.practiceSentences || [])) {
    paragraphs.push({ en: s.en, zh: s.zh });
  }
  const wordCount = paragraphs.map(p => p.en).join(' ').split(/\s+/).length;

  const tagColors = { '音标发音': '#FA709A', '连读技巧': '#A18CD1' };
  const tagIcons = { '音标发音': 'textformat.abc', '连读技巧': 'link' };

  return {
    title: data.title || topic,
    titleZh: data.titleZh || '',
    category: '发音口语',
    tag,
    subTag: subGroup.subTag,
    subTagIcon: subGroup.icon,
    contentType: 'pronunciation',
    level: '初级',
    paragraphs,
    extraData: {
      explanation: data.explanation,
      examples: data.examples,
      practiceSentences: data.practiceSentences,
      commonMistakes: data.commonMistakes,
      tips: data.tips,
    },
    wordCount,
    source: 'AI Pronunciation',
    coverIcon: tagIcons[tag] || 'textformat.abc',
    coverColor: tagColors[tag] || '#FA709A',
  };
}

// ============================
// GLM API 调用
// ============================

function callGLM(prompt, temperature = 0.3) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: 3000,
    });
    const options = {
      hostname: 'open.bigmodel.cn',
      path: '/api/paas/v4/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 45000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.message?.content || '';
          const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          const braceMatch = clean.match(/\{[\s\S]*\}/);
          resolve(braceMatch ? braceMatch[0] : clean);
        } catch (e) {
          reject(new Error('解析 GLM 响应失败'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('GLM 请求超时')); });
    req.write(body);
    req.end();
  });
}

// 每日泛听的轮流列表（覆盖所有 subTag）
function buildRotationList(catName) {
  const list = [];
  const cat = CATEGORY_TREE[catName];
  for (const [tag, subTags] of Object.entries(cat)) {
    for (const sub of subTags) {
      list.push({ tag, subTag: sub.subTag });
    }
  }
  return list;
}

module.exports = {
  CATEGORY_TREE,
  generateDialogueArticle,
  generateExamArticle,
  generatePronunciationArticle,
  buildRotationList,
};
