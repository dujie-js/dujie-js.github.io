/**
 * themes.js — 主题定义的唯一来源(单源)
 *
 * 浏览器:window.THEMES(需在 theme-loader.js 之前加载)
 * Node:module.exports(CI 的 update-wakatime.js 从此派生 THEME_RULES)
 *
 * 加主题只需在此追加一项,前端加载与 CI 阈值规则自动生效。
 * 每项显式声明 maxHours(小时阈值上限)与 particle(是否粒子特效),
 * 键序即强度顺序(休息日 → 超神日),CI 按 maxHours 升序构建档位规则。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.THEMES = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    rest: {
      name: '休息日',
      colors: { c1: '#1a1a2e', c2: '#16213e', c3: '#0f3460' },
      glowSize: '10px',
      pulseSpeed: '4s',
      emoji: '🛌',
      // 小时阈值上限:当日编码时长 < maxHours 即命中本档;按强度从小到大排列
      maxHours: 1,
      particle: false,
    },
    relaxed: {
      name: '轻松日',
      colors: { c1: '#134e5e', c2: '#71b280', c3: '#a8e6cf' },
      glowSize: '20px',
      pulseSpeed: '3s',
      emoji: '🌱',
      maxHours: 3,
      particle: false,
    },
    productive: {
      name: '充实日',
      colors: { c1: '#f12711', c2: '#f5af19', c3: '#ff9a9e' },
      glowSize: '25px',
      pulseSpeed: '2s',
      emoji: '⚡',
      maxHours: 5,
      particle: false,
    },
    focused: {
      name: '专注日',
      colors: { c1: '#ff416c', c2: '#ff4b2b', c3: '#ff9a9e' },
      glowSize: '30px',
      pulseSpeed: '1s',
      emoji: '🔥',
      maxHours: 7,
      particle: false,
    },
    intense: {
      name: '极限日',
      colors: { c1: '#8e2de2', c2: '#4a00e0', c3: '#00c6ff' },
      glowSize: '35px',
      pulseSpeed: '0.8s',
      emoji: '🌟',
      maxHours: 9,
      particle: true,
    },
    legendary: {
      name: '超神日',
      colors: { c1: '#00c6ff', c2: '#0072ff', c3: '#ffffff' },
      glowSize: '50px',
      pulseSpeed: '0.5s',
      emoji: '💥',
      maxHours: Infinity,
      particle: true,
    },
  };
});
