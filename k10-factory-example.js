// The official original sketches remain available alongside the editable port.
const k10FactoryVersions = {
  '241202': {
    label: '2024-12-02 · 经典出厂版',
    file: 'UNIHIKER K10-UserProgram-CN-241202.C',
    source: 'examples/k10-factory/UNIHIKER-K10-UserProgram-CN-241202.C',
    archive: 'examples/k10-factory/UNIHIKER-K10-UserProgram-CN-241202.zip'
  },
  '260810': {
    label: '2026-08-10 · 显示修复版',
    file: 'UNIHIKER K10-UserProgram-CN-260810.cpp',
    source: 'examples/k10-factory/UNIHIKER-K10-UserProgram-CN-260810.cpp',
    archive: 'examples/k10-factory/UNIHIKER-K10-UserProgram-CN-260810.zip'
  }
};
const k10FactorySourceCache = new Map();
let k10FactoryLoadId = 0;

function k10FactoryLogicPreview(source) {
  // Fold only bitmap byte arrays. Copy and download always retain every byte.
  return '// 阅读视图：图片字节数组已折叠。复制完整源码或下载 ZIP 可获得全部资源。\n\n' +
    source.replace(/((?:static\s+)?const\s+(?:uint8_t|unsigned\s+char)\s+\w+\s*\[[^\]]*\]\s*(?:PROGMEM\s*)?=\s*\{)[\s\S]*?(\};)/g,
      (_, start, end) => `${start}\n  /* 图片资源数据已折叠 */\n${end}`);
}

async function loadK10FactorySource(version) {
  const info = k10FactoryVersions[version];
  if (!info) throw new Error('未找到这个出厂程序版本');
  if (k10FactorySourceCache.has(version)) return k10FactorySourceCache.get(version);
  const response = await fetch(info.source);
  if (!response.ok) throw new Error('源码暂未加载成功，请重试或从官方说明下载');
  const source = await response.text();
  if (!source.includes('void setup()') || !source.includes('void loop()')) {
    throw new Error('下载内容不是完整的 K10 出厂源码，请从官方说明下载');
  }
  k10FactorySourceCache.set(version, source);
  return source;
}

async function renderK10FactoryExample() {
  const loadId = ++k10FactoryLoadId;
  const version = document.querySelector('#factoryVersion').value;
  const info = k10FactoryVersions[version];
  const status = document.querySelector('#factoryStatus');
  const code = document.querySelector('#factoryCode');
  const copy = document.querySelector('#copyFactorySource');
  const download = document.querySelector('#downloadFactorySource');
  copy.disabled = true;
  code.textContent = '';
  status.textContent = '正在加载官方源码…';
  document.querySelector('#factoryFilename').textContent = info.file;
  download.href = info.archive;
  download.download = info.archive.split('/').pop();
  try {
    const source = await loadK10FactorySource(version);
    if (loadId !== k10FactoryLoadId) return;
    code.textContent = document.querySelector('#factoryCodeView').value === 'full'
      ? source : k10FactoryLogicPreview(source);
    code.parentElement.scrollTop = 0;
    status.textContent = '官方原始源码已加载。可复制全部内容到 Mind+ 手动编程区，再编译、上传。';
    copy.disabled = false;
  } catch (error) {
    if (loadId === k10FactoryLoadId) status.textContent = error.message;
  }
}

function openK10FactoryExample() {
  document.querySelector('#examplesPopover').hidden = true;
  document.querySelector('#factoryExampleDialog').showModal();
  renderK10FactoryExample();
}

function bindK10FactoryExample() {
  document.querySelector('#factorySourceBtn').addEventListener('click', openK10FactoryExample);
  document.querySelector('#factoryHelpSource').addEventListener('click', openK10FactoryExample);
  document.querySelector('#closeFactoryExample').addEventListener('click', () => {
    document.querySelector('#factoryExampleDialog').close();
  });
  document.querySelector('#factoryVersion').addEventListener('change', renderK10FactoryExample);
  document.querySelector('#factoryCodeView').addEventListener('change', renderK10FactoryExample);
  document.querySelector('#copyFactorySource').addEventListener('click', async () => {
    const button = document.querySelector('#copyFactorySource');
    const version = document.querySelector('#factoryVersion').value;
    button.disabled = true;
    try {
      const source = await loadK10FactorySource(version);
      await navigator.clipboard.writeText(source);
      document.querySelector('#factoryStatus').textContent = '完整源码已复制，包含所有图片资源。粘贴到 Mind+ 手动编程区即可。';
      toast('完整出厂源码已复制');
    } catch {
      document.querySelector('#factoryStatus').textContent = '复制未成功，请下载官方源码 ZIP 后用文本编辑器打开。';
    } finally {
      button.disabled = !k10FactorySourceCache.has(document.querySelector('#factoryVersion').value);
    }
  });
}
