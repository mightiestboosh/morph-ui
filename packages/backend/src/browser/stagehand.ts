import { Stagehand } from '@browserbasehq/stagehand';

let activeInstances = 0;
const MAX_INSTANCES = 10;

// Scrapling + puppeteer-extra-plugin-stealth combined args
const STEALTH_ARGS = [
  // --- Core stealth ---
  '--disable-blink-features=AutomationControlled',
  '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
  '--fingerprinting-canvas-image-data-noise',
  '--webrtc-ip-handling-policy=disable_non_proxied_udp',
  '--force-webrtc-ip-handling-policy',
  '--force-color-profile=srgb',
  '--font-render-hinting=none',
  // --- Look like a real browser ---
  '--test-type',
  '--lang=en-US',
  '--accept-lang=en-US',
  '--start-maximized',
  '--window-size=1920,1080',
  '--no-sandbox',
  '--mute-audio',
  // --- Disable telemetry / crash reporting ---
  '--disable-sync',
  '--disable-logging',
  '--disable-dev-shm-usage',
  '--disable-crash-reporter',
  '--disable-domain-reliability',
  '--disable-background-networking',
  '--disable-client-side-phishing-detection',
  '--metrics-recording-only',
  '--safebrowsing-disable-auto-update',
  // --- Performance / render ---
  '--enable-async-dns',
  '--enable-tcp-fast-open',
  '--enable-simple-cache-backend',
  '--enable-surface-synchronization',
  '--disable-partial-raster',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-background-timer-throttling',
  '--disable-ipc-flooding-protection',
  '--disable-new-content-rendering-timeout',
  '--run-all-compositor-stages-before-draw',
  '--aggressive-cache-discard',
  '--disable-image-animation-resync',
  '--ignore-gpu-blocklist',
  '--disable-checker-imaging',
  '--disable-threaded-animation',
  '--disable-threaded-scrolling',
  '--disable-layer-tree-host-memory-pressure',
  // --- Hide automation UI ---
  '--hide-scrollbars',
  '--disable-translate',
  '--disable-voice-input',
  '--disable-print-preview',
  '--disable-prompt-on-repost',
  '--disable-cookie-encryption',
  '--disable-cloud-import',
  '--disable-wake-on-wifi',
  '--disable-gesture-typing',
  '--use-mock-keychain',
  '--autoplay-policy=user-gesture-required',
  '--disable-offer-upload-credit-cards',
  '--disable-offer-store-unmasked-wallet-cards',
  '--disable-component-extensions-with-background-pages',
  '--prerender-from-omnibox=disabled',
  // --- Features ---
  '--enable-features=NetworkService,NetworkServiceInProcess,TrustTokens,TrustTokensAlwaysAllowIssuance',
  '--disable-features=AudioServiceOutOfProcess,TranslateUI,BlinkGenPropertyTrees,AutomationControlled,IsolateOrigins,site-per-process',
  '--enable-web-bluetooth',
];

// Args that Playwright/Chromium add by default that scream "automation"
const HARMFUL_ARGS = [
  '--enable-automation',
  '--disable-popup-blocking',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-extensions',
];

// Comprehensive stealth JS — sourced from scrapling + puppeteer-extra-plugin-stealth
const STEALTH_SCRIPT = `
// 1. navigator.webdriver — delete from prototype chain
try {
  delete Object.getPrototypeOf(navigator).webdriver;
} catch (e) {}
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

// 2. navigator.plugins — realistic plugin array
(function() {
  const PLUGINS = [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format',
      mimeTypes: [{ type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '',
      mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: '' }] },
    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '',
      mimeTypes: [
        { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
        { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
      ] },
  ];

  function makeMimeType(m, plugin) {
    const mt = Object.create(MimeType.prototype);
    Object.defineProperties(mt, {
      type: { get: () => m.type },
      suffixes: { get: () => m.suffixes },
      description: { get: () => m.description },
      enabledPlugin: { get: () => plugin },
    });
    return mt;
  }

  function makePlugin(p) {
    const plugin = Object.create(Plugin.prototype);
    const mimes = p.mimeTypes.map(m => makeMimeType(m, plugin));
    Object.defineProperties(plugin, {
      name: { get: () => p.name },
      filename: { get: () => p.filename },
      description: { get: () => p.description },
      length: { get: () => mimes.length },
    });
    mimes.forEach((m, i) => {
      Object.defineProperty(plugin, i, { get: () => m });
      Object.defineProperty(plugin, m.type, { get: () => m });
    });
    plugin[Symbol.iterator] = function*() { for (const m of mimes) yield m; };
    return { plugin, mimes };
  }

  const plugins = PLUGINS.map(makePlugin);
  const allMimes = plugins.flatMap(p => p.mimes);
  const pluginArr = plugins.map(p => p.plugin);

  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const arr = Object.create(PluginArray.prototype);
      pluginArr.forEach((p, i) => {
        Object.defineProperty(arr, i, { get: () => p });
        Object.defineProperty(arr, p.name, { get: () => p });
      });
      Object.defineProperty(arr, 'length', { get: () => pluginArr.length });
      arr.refresh = () => {};
      arr[Symbol.iterator] = function*() { for (const p of pluginArr) yield p; };
      return arr;
    },
  });

  Object.defineProperty(navigator, 'mimeTypes', {
    get: () => {
      const arr = Object.create(MimeTypeArray.prototype);
      allMimes.forEach((m, i) => {
        Object.defineProperty(arr, i, { get: () => m });
        Object.defineProperty(arr, m.type, { get: () => m });
      });
      Object.defineProperty(arr, 'length', { get: () => allMimes.length });
      arr[Symbol.iterator] = function*() { for (const m of allMimes) yield m; };
      return arr;
    },
  });
})();

// 3. navigator.languages
Object.defineProperty(navigator, 'languages', { get: () => Object.freeze(['en-US', 'en']) });

// 4. navigator.vendor
Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });

// 5. navigator.hardwareConcurrency — realistic value
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

// 6. navigator.deviceMemory
Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

// 7. navigator.maxTouchPoints
Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });

// 8. navigator.connection — realistic network info
if (!navigator.connection) {
  Object.defineProperty(navigator, 'connection', {
    get: () => ({ effectiveType: '4g', rtt: 50, downlink: 10, saveData: false }),
  });
}

// 9. Chrome runtime + app + csi + loadTimes mocking
window.chrome = {
  app: {
    isInstalled: false,
    InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
    RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
    getDetails: () => null,
    getIsInstalled: () => false,
    runningState: () => 'cannot_run',
  },
  runtime: {
    OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
    OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
    PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
    PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
    PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
    RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
    connect: function(extId) {
      if (typeof extId !== 'string' || !/^[a-p]{32}$/.test(extId)) throw new TypeError('Invalid extension id');
      return { onDisconnect: { addListener: () => {} }, onMessage: { addListener: () => {} }, postMessage: () => {} };
    },
    sendMessage: function() {
      if (arguments.length < 2) throw new TypeError("chrome.runtime.sendMessage requires at least 2 arguments");
    },
    id: undefined,
  },
  csi: () => ({ startE: Date.now(), onloadT: Date.now() + 300, pageT: Date.now() + 1200, tran: 15 }),
  loadTimes: () => ({
    commitLoadTime: Date.now() / 1000,
    connectionInfo: 'h2',
    finishDocumentLoadTime: Date.now() / 1000 + 0.3,
    finishLoadTime: Date.now() / 1000 + 0.5,
    firstPaintAfterLoadTime: 0,
    firstPaintTime: Date.now() / 1000 + 0.1,
    navigationType: 'Other',
    npnNegotiatedProtocol: 'h2',
    requestTime: Date.now() / 1000 - 0.2,
    startLoadTime: Date.now() / 1000 - 0.1,
    wasAlternateProtocolAvailable: false,
    wasFetchedViaSpdy: true,
    wasNpnNegotiated: true,
  }),
};

// 10. navigator.permissions — fix headless inconsistency
const origQuery = navigator.permissions.query.bind(navigator.permissions);
navigator.permissions.query = (params) => {
  if (params.name === 'notifications') {
    return Promise.resolve({ state: Notification.permission, onchange: null });
  }
  return origQuery(params).catch(() =>
    Promise.resolve({ state: 'prompt', onchange: null })
  );
};

// 11. WebGL renderer spoofing — hide SwiftShader / ANGLE
(function() {
  const getParam = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(p) {
    if (p === 37445) return 'Intel Inc.';
    if (p === 37446) return 'Intel Iris OpenGL Engine';
    return getParam.call(this, p);
  };
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const getParam2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(p) {
      if (p === 37445) return 'Intel Inc.';
      if (p === 37446) return 'Intel Iris OpenGL Engine';
      return getParam2.call(this, p);
    };
  }
})();

// 12. Media codec spoofing
(function() {
  const origCanPlayType = HTMLMediaElement.prototype.canPlayType;
  HTMLMediaElement.prototype.canPlayType = function(type) {
    if (type.includes('video/mp4')) return 'probably';
    if (type.includes('audio/x-m4a')) return 'maybe';
    if (type.includes('audio/aac')) return 'probably';
    if (type.includes('audio/mpeg')) return 'probably';
    return origCanPlayType.call(this, type);
  };
})();

// 13. iframe contentWindow.chrome check evasion
(function() {
  const origCreate = document.createElement.bind(document);
  document.createElement = function() {
    const el = origCreate.apply(this, arguments);
    if (el.tagName === 'IFRAME') {
      const origGet = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')?.get;
      if (origGet) {
        Object.defineProperty(el, 'contentWindow', {
          get: function() {
            const win = origGet.call(this);
            if (win) { try { win.chrome = window.chrome; } catch(e) {} }
            return win;
          },
        });
      }
    }
    return el;
  };
})();

// 14. window.outerWidth/outerHeight — match inner dimensions (headless fix)
if (window.outerWidth === 0) {
  Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
  Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 85 });
}

// 15. Notification.permission — must not be 'denied' in headless
if (Notification.permission === 'denied') {
  Object.defineProperty(Notification, 'permission', { get: () => 'default' });
}

// 16. Screen dimensions — realistic values
Object.defineProperty(screen, 'width', { get: () => 1920 });
Object.defineProperty(screen, 'height', { get: () => 1080 });
Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
Object.defineProperty(screen, 'availHeight', { get: () => 1055 });
Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
`;

export async function getStagehand(): Promise<Stagehand> {
  if (activeInstances >= MAX_INSTANCES) {
    throw new Error(`Maximum concurrent browser instances (${MAX_INSTANCES}) reached`);
  }

  const stagehand = new Stagehand({
    env: 'LOCAL',
    modelName: 'claude-sonnet-4-20250514',
    modelClientOptions: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    enableCaching: false,
    localBrowserLaunchOptions: {
      headless: true,
      args: STEALTH_ARGS,
      ignoreDefaultArgs: HARMFUL_ARGS,
    },
  });

  await stagehand.init();
  activeInstances++;

  // Apply comprehensive stealth patches
  try {
    const page = stagehand.page;

    // Inject stealth scripts before any page loads
    await page.addInitScript(STEALTH_SCRIPT);

    // Set realistic viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Set realistic user-agent (remove HeadlessChrome)
    const currentUA = await page.evaluate(() => navigator.userAgent);
    const cleanUA = currentUA
      .replace(/HeadlessChrome/g, 'Chrome')
      .replace(/headless/gi, '');
    await page.context().addInitScript(`Object.defineProperty(navigator, 'userAgent', { get: () => '${cleanUA}' });`);

    // Set realistic extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    });
  } catch (err) {
    console.error('Failed to apply stealth scripts:', err);
  }

  return stagehand;
}

export async function releaseStagehand(instance: Stagehand): Promise<void> {
  try {
    await instance.close();
  } catch (err) {
    console.error('Error closing stagehand instance:', err);
  } finally {
    activeInstances = Math.max(0, activeInstances - 1);
  }
}
