const DEFAULTS = Object.freeze({
  siteCount: 240,
  folderCount: 60,
  bookmarksPerSite: 5,
  credentialsPerEntry: 3,
});

const LIMITS = Object.freeze({
  siteCount: 5_000,
  folderCount: 5_000,
  bookmarksPerSite: 100,
  credentialsPerEntry: 100,
});

const ACCENTS = ['#1D4ED8', '#0EA5A5', '#22C55E', '#F59E0B', '#F43F5E', '#475569'];
const EXPORTED_AT = '2026-09-04T12:00:00.000Z';

function readSize(options, name) {
  const value = options[name] ?? DEFAULTS[name];
  if (!Number.isSafeInteger(value) || value < 0 || value > LIMITS[name]) {
    throw new RangeError(`${name} 必须是 0 到 ${LIMITS[name]} 之间的整数。`);
  }
  return value;
}

function pad(value, width = 4) {
  return String(value).padStart(width, '0');
}

function timestamp(index) {
  return new Date(Date.UTC(2026, 8, 1, 8, index % 60, index % 60)).toISOString();
}

function createCredential(parentId, index, sequence) {
  const weak = sequence % 11 === 0;
  return {
    id: `credential-${parentId}-${pad(index, 2)}`,
    label: index === 1 ? '管理员账号' : `备用账号 ${index}`,
    username: `user.${parentId}.${index}@example.test`,
    password: weak ? '123456' : `MKey!${pad(sequence, 6)}Aa`,
    note: sequence % 17 === 0 ? '用于搜索验证：季度轮换账号，禁止共享。' : '批量测试生成的虚拟账号，不包含真实信息。',
    createdAt: timestamp(sequence),
    updatedAt: timestamp(sequence + 1),
  };
}

function createBookmark(siteId, index, sequence) {
  const longTitle = sequence % 47 === 0
    ? '超长书签标题用于验证窄屏布局与按钮不会互相覆盖'.repeat(3)
    : `工作台 ${index}`;
  return {
    id: `bookmark-${siteId}-${pad(index, 2)}`,
    title: longTitle,
    url: `https://${siteId}.example.test/tools/${index}?source=stress-data`,
    description: sequence % 19 === 0 ? '用于搜索验证：发布检查清单与监控面板。' : '批量测试书签。',
    pinned: index === 1,
    createdAt: timestamp(sequence),
    updatedAt: timestamp(sequence + 1),
  };
}

export function createStressVault(options = {}) {
  const siteCount = readSize(options, 'siteCount');
  const folderCount = readSize(options, 'folderCount');
  const bookmarksPerSite = readSize(options, 'bookmarksPerSite');
  const credentialsPerEntry = readSize(options, 'credentialsPerEntry');
  const sites = [];
  let sequence = 0;

  for (let index = 1; index <= siteCount; index += 1) {
    const id = `site-${pad(index)}`;
    const bookmarks = Array.from({ length: bookmarksPerSite }, (_, bookmarkIndex) => {
      sequence += 1;
      return createBookmark(id, bookmarkIndex + 1, sequence);
    });
    const credentials = Array.from({ length: credentialsPerEntry }, (_, credentialIndex) => {
      sequence += 1;
      return createCredential(id, credentialIndex + 1, sequence);
    });
    sites.push({
      id,
      kind: 'site',
      name: index % 53 === 0 ? `超长网站名称 ${'MKey 压力测试 '.repeat(8)}${index}` : `测试网站 ${pad(index)}`,
      domain: `${id}.example.test`,
      description: index % 23 === 0 ? '用于搜索验证：研发协作、发布流程、数据看板和日常运营。' : 'MKey 批量测试网站。',
      tags: index % 7 === 0 ? ['测试', '研发', '高频使用'] : ['测试', `分组-${index % 12}`],
      accent: ACCENTS[index % ACCENTS.length],
      favorite: index % 9 === 0,
      createdAt: timestamp(sequence),
      updatedAt: timestamp(sequence + 1),
      bookmarks,
      credentials,
    });
  }

  for (let index = 1; index <= folderCount; index += 1) {
    const id = `folder-${pad(index)}`;
    const credentials = Array.from({ length: credentialsPerEntry }, (_, credentialIndex) => {
      sequence += 1;
      return createCredential(id, credentialIndex + 1, sequence);
    });
    sites.push({
      id,
      kind: 'folder',
      name: `非网站资料 ${pad(index)}`,
      domain: '',
      description: '许可证、设备或本地服务等没有公开网址的账号信息。',
      tags: ['测试', '非网站'],
      accent: ACCENTS[(siteCount + index) % ACCENTS.length],
      favorite: index % 10 === 0,
      createdAt: timestamp(sequence),
      updatedAt: timestamp(sequence + 1),
      bookmarks: [],
      credentials,
    });
  }

  return { exportedAt: EXPORTED_AT, sites };
}
