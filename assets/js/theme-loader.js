/**
 * WakaTime Theme Loader
 * 根据 config.json 自动应用主题
 */

(function () {
  'use strict';

  // 主题定义来自 themes.js(与 CI 的 THEME_RULES 同源,加主题只改一处)
  let THEMES =
    (typeof window !== 'undefined' && window.THEMES) || null;

  let SCRIPT_CACHE = {};
  let LAST_CONFIG = null;

  // URL 参数调试仅在本地环境(file:// 或 localhost)生效,
  // 防止他人分享带 ?theme=legendary&hours=6 的线上链接时覆盖访问者主题
  function isLocalEnvironment() {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return (
      protocol === 'file:' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    );
  }

  function loadConfig() {
    // Debug: Check URL parameters first (local only)
    // Example: ?theme=focused&hours=6
    let urlParams = new URLSearchParams(window.location.search);
    if (
      isLocalEnvironment() &&
      (urlParams.has('theme') || urlParams.has('hours'))
    ) {
      console.log('🔧 Debug mode: Using URL parameters');
      let debugConfig = {
        theme_name: urlParams.get('theme') || 'rest',
        hours: parseFloat(urlParams.get('hours')) || 0,
        date: new Date().toISOString().split('T')[0],
      };
      applyTheme(debugConfig);
      return;
    }

    // Main execution: Load config via script tag
    loadScript('assets/json/config.js', function (err) {
      if (!err && window.WAKATIME_CONFIG) {
        applyTheme(window.WAKATIME_CONFIG);
      } else {
        console.warn('Config load failed:', err);
        // Fallback
        applyTheme({
          theme_name: 'rest',
          hours: 0,
          theme_display: '初始化',
        });
      }
    });
  }

  // Helper to load scripts dynamically
  function loadScript(url, callback) {
    let script = document.createElement('script');
    script.src = url + '?t=' + new Date().getTime();
    script.onload = function () {
      callback(null);
      // Optional: remove script after loading to keep DOM clean
      // script.remove();
    };
    script.onerror = function () {
      callback(new Error('Failed to load ' + url));
    };
    document.body.appendChild(script);
  }

  function loadScriptCached(url, callback) {
    if (SCRIPT_CACHE[url] && SCRIPT_CACHE[url].state === 'loaded') {
      callback(null);
      return;
    }
    if (SCRIPT_CACHE[url] && SCRIPT_CACHE[url].state === 'loading') {
      SCRIPT_CACHE[url].callbacks.push(callback);
      return;
    }

    SCRIPT_CACHE[url] = { state: 'loading', callbacks: [callback] };

    let script = document.createElement('script');
    script.src = url;
    script.onload = function () {
      let callbacks = SCRIPT_CACHE[url].callbacks.slice();
      SCRIPT_CACHE[url].state = 'loaded';
      SCRIPT_CACHE[url].callbacks = [];
      for (let i = 0; i < callbacks.length; i++) {
        callbacks[i](null);
      }
    };
    script.onerror = function () {
      let callbacks = SCRIPT_CACHE[url].callbacks.slice();
      SCRIPT_CACHE[url].state = 'error';
      SCRIPT_CACHE[url].callbacks = [];
      for (let i = 0; i < callbacks.length; i++) {
        callbacks[i](new Error('Failed to load ' + url));
      }
    };
    document.body.appendChild(script);
  }

  function getWeeklyUrl(config) {
    let version =
      config && (config.updated_at || config.date)
        ? String(config.updated_at || config.date)
        : '';
    if (!version) return 'assets/json/weekly.js';
    return 'assets/json/weekly.js?v=' + encodeURIComponent(version);
  }

  function prefetchWeekly(config) {
    let url = getWeeklyUrl(config);
    loadScriptCached(url, function () {});
  }

  function applyTheme(config) {
    if (!THEMES) {
      console.error('themes.js 未在 theme-loader.js 之前加载,主题应用中止');
      return;
    }
    let themeName = config.theme_name || 'rest';
    let theme = THEMES[themeName] || THEMES.rest;
    LAST_CONFIG = config;

    // 仅设置被样式实际消费的变量（--glow-size 头像光晕 / --pulse-speed 脉冲 / --wakatime-theme-color 光晕颜色）
    document.documentElement.style.setProperty('--glow-size', theme.glowSize);
    document.documentElement.style.setProperty(
      '--pulse-speed',
      theme.pulseSpeed,
    );

    // 主题主色（取自 THEMES.colors.c1）用于头像光晕与点缀
    let mainColor = (theme.colors && theme.colors.c1) || '#ffffff';
    document.documentElement.style.setProperty(
      '--wakatime-theme-color',
      mainColor,
    );

    // Remove the background override to let Bing image show through naturally
    // We will use the theme color for accents instead
    let targetElement = document.querySelector('.panel-cover--overlay');
    if (targetElement) {
      targetElement.style.background = '';
      targetElement.classList.remove('animated-bg');
    }

    let avatar = document.querySelector('.js-avatar');
    if (avatar) {
      avatar.classList.add('glowing');
    }

    updateStatusDisplay(config, theme);

    // 初始化周报弹窗交互
    initWeeklyStats(config, theme);
    prefetchWeekly(config);

    if (themeName === 'intense' || themeName === 'legendary') {
      addParticleEffects();
    }

    console.log(
      '🎨 Theme applied:',
      theme.name,
      '(' + config.hours + ' hours)',
    );
  }

  function updateStatusDisplay(config, theme) {
    let statusEl = document.getElementById('wakatime-status');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'wakatime-status';
      statusEl.className = 'wakatime-status';
      document.body.appendChild(statusEl);
    }

    // 添加点击提示样式与键盘可达性
    statusEl.style.cursor = 'pointer';
    statusEl.title = '点击查看本周能量报告';
    statusEl.setAttribute('role', 'button');
    statusEl.setAttribute('tabindex', '0');
    statusEl.setAttribute('aria-label', '查看本周编码报告');

    statusEl.innerHTML =
      '<span class="wt-emoji">' +
      theme.emoji +
      '</span> ' +
      '<span class="wt-text">' +
      theme.name +
      ' · ' +
      config.hours +
      'h</span>';
  }

  function initWeeklyStats(config, theme) {
    let statusEl = document.getElementById('wakatime-status');
    if (!statusEl) return;

    // 避免重复绑定
    let newEl = statusEl.cloneNode(true);
    statusEl.parentNode.replaceChild(newEl, statusEl);
    statusEl = newEl;

    const openModal = function () {
      // 检查是否已存在弹窗
      let existingModal = document.querySelector('.weekly-modal');
      if (existingModal) {
        existingModal.classList.add('show');
        return;
      }

      let modal = createWeeklyModal(theme);
      document.body.appendChild(modal);
      void modal.offsetWidth;
      setTimeout(function () {
        modal.classList.add('show');
      }, 10);

      let url = getWeeklyUrl(config || LAST_CONFIG);
      loadScriptCached(url, function (err) {
        if (!err && window.WAKATIME_WEEKLY) {
          renderWeeklyModal(modal, window.WAKATIME_WEEKLY, theme);
        } else {
          renderWeeklyModalError(modal);
        }
      });
    };

    statusEl.addEventListener('click', openModal);
    // 键盘可达:Enter/Space 打开弹窗
    statusEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal();
      }
    });
  }

  function createWeeklyModal(theme) {
    let chartHeight = 100;
    let chartWidth = 340;

    let modal = document.createElement('div');
    modal.className = 'weekly-modal is-loading';

    modal.innerHTML =
      '<div class="modal-backdrop"></div>' +
      '<div class="modal-content">' +
      '<div class="modal-header">' +
      '<div class="ai-badge" style="--badge-color: ' +
      theme.colors.c1 +
      '"></div>' +
      '<h2>SYSTEM MONITOR</h2>' +
      '</div>' +
      '<div class="weekly-chart-container">' +
      '<svg viewBox="0 0 ' +
      chartWidth +
      ' ' +
      (chartHeight + 20) +
      '" preserveAspectRatio="none">' +
      '<pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">' +
      '<path d="M 40 0 L 0 0 0 20" fill="none" stroke="#222" stroke-width="1"></path>' +
      '</pattern>' +
      '<rect width="100%" height="100%" fill="url(#grid)"></rect>' +
      '<defs>' +
      '<linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">' +
      '<stop offset="0%" stop-color="' +
      theme.colors.c1 +
      '" stop-opacity="0.2"></stop>' +
      '<stop offset="100%" stop-color="' +
      theme.colors.c1 +
      '" stop-opacity="0"></stop>' +
      '</linearGradient>' +
      '</defs>' +
      '<path class="weekly-fill" fill="url(#chartGradient)"></path>' +
      '<path class="weekly-line" fill="none" stroke="' +
      theme.colors.c1 +
      '" stroke-width="1.5" stroke-linecap="round"></path>' +
      '</svg>' +
      '</div>' +
      '<div class="ai-insight"><p>Loading...</p></div>' +
      '<div class="stats-grid">' +
      '<div class="stat-item"><span class="val">--</span><span class="key">TOTAL</span></div>' +
      '<div class="stat-item"><span class="val">--</span><span class="key">AVG</span></div>' +
      '<div class="stat-item"><span class="val">--</span><span class="key">PEAK</span></div>' +
      '</div>' +
      '</div>';

    const closeModal = function () {
      modal.classList.remove('show');
      setTimeout(function () {
        modal.remove();
      }, 200);
    };

    modal
      .querySelector('.modal-backdrop')
      .addEventListener('click', closeModal);
    // Esc 关闭弹窗
    modal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModal();
      }
    });
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', '本周编码报告');
    // 让弹窗可获得焦点以便 Esc 生效
    modal.setAttribute('tabindex', '-1');
    modal.focus();

    return modal;
  }

  function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim());
  }

  function safeNumber(value, fallback) {
    let n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function catmullRom2bezier(points) {
    let result = [];
    for (let i = 0; i < points.length - 1; i++) {
      let p0 = i === 0 ? points[0] : points[i - 1];
      let p1 = points[i];
      let p2 = points[i + 1];
      let p3 = i + 2 < points.length ? points[i + 2] : p2;

      let cp1x = p1.x + (p2.x - p0.x) / 6;
      let cp1y = p1.y + (p2.y - p0.y) / 6;
      let cp2x = p2.x - (p3.x - p1.x) / 6;
      let cp2y = p2.y - (p3.y - p1.y) / 6;

      result.push(
        'C ' +
          cp1x +
          ',' +
          cp1y +
          ' ' +
          cp2x +
          ',' +
          cp2y +
          ' ' +
          p2.x +
          ',' +
          p2.y,
      );
    }
    return result.join(' ');
  }

  function renderWeeklyModal(modal, data, theme) {
    if (!modal) return;

    modal.classList.remove('is-loading');

    let chartHeight = 100;
    let chartWidth = 340;
    let days = data && Array.isArray(data.days) ? data.days : [];

    if (days.length < 2) {
      renderWeeklyModalError(modal);
      return;
    }

    let maxHours = Math.max.apply(
      null,
      days
        .map(function (d) {
          return d.hours;
        })
        .concat([1]),
    );
    let points = days.map(function (day, index) {
      let x = (index / (days.length - 1)) * chartWidth;
      let y = chartHeight - (day.hours / maxHours) * chartHeight;
      return { x: x, y: y };
    });

    let pathD =
      'M ' + points[0].x + ',' + points[0].y + ' ' + catmullRom2bezier(points);
    let fillD =
      pathD +
      ' L ' +
      chartWidth +
      ',' +
      (chartHeight + 20) +
      ' L 0,' +
      (chartHeight + 20) +
      ' Z';

    let fillPath = modal.querySelector('.weekly-fill');
    let linePath = modal.querySelector('.weekly-line');
    if (fillPath) fillPath.setAttribute('d', fillD);
    if (linePath) linePath.setAttribute('d', pathD);

    let badgeColor = isHexColor(data && data.ai && data.ai.theme_color)
      ? data.ai.theme_color.trim()
      : theme.colors.c1;
    let badgeEl = modal.querySelector('.ai-badge');
    if (badgeEl) {
      badgeEl.style.setProperty('--badge-color', badgeColor);
      badgeEl.textContent =
        data && data.ai && typeof data.ai.tarot === 'string'
          ? data.ai.tarot
          : '';
    }

    let quoteEl = modal.querySelector('.ai-insight p');
    if (quoteEl) {
      quoteEl.textContent =
        data && data.ai && typeof data.ai.quote === 'string'
          ? data.ai.quote
          : '';
    }

    let statVals = modal.querySelectorAll('.stat-item .val');
    if (statVals && statVals.length === 3) {
      statVals[0].textContent =
        String(safeNumber(data && data.stats && data.stats.total_hours, 0)) +
        'h';
      statVals[1].textContent =
        String(safeNumber(data && data.stats && data.stats.daily_avg, 0)) + 'h';
      statVals[2].textContent =
        String(
          safeNumber(
            data &&
              data.stats &&
              data.stats.max_day &&
              data.stats.max_day.hours,
            0,
          ),
        ) + 'h';
    }
  }

  function renderWeeklyModalError(modal) {
    if (!modal) return;
    modal.classList.remove('is-loading');
    let quoteEl = modal.querySelector('.ai-insight p');
    if (quoteEl) quoteEl.textContent = '加载失败，请稍后再试';
  }

  function addParticleEffects() {
    if (document.getElementById('particle-container')) return;

    let container = document.createElement('div');
    container.id = 'particle-container';
    container.className = 'particle-container';

    let targetElement = document.querySelector('.panel-cover') || document.body;
    targetElement.appendChild(container);

    for (let i = 0; i < 20; i++) {
      let particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 2 + 's';
      container.appendChild(particle);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadConfig);
  } else {
    loadConfig();
  }
})();
