/**
 * themes.js — 主题定义的唯一来源(单源)
 *
 * 浏览器:window.THEMES(需在 theme-loader.js 之前加载)
 * Node:module.exports(CI 的 update-wakatime.js 从此派生 THEME_RULES)
 *
 * 加主题只需在此追加一项,前端加载与 CI 阈值规则自动生效。
 * 对象键顺序即强度顺序(休息日 → 超神日),CI 据此推导小时阈值。
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
    },
    relaxed: {
      name: '轻松日',
      colors: { c1: '#134e5e', c2: '#71b280', c3: '#a8e6cf' },
      glowSize: '20px',
      pulseSpeed: '3s',
      emoji: '🌱',
    },
    productive: {
      name: '充实日',
      colors: { c1: '#f12711', c2: '#f5af19', c3: '#ff9a9e' },
      glowSize: '25px',
      pulseSpeed: '2s',
      emoji: '⚡',
    },
    focused: {
      name: '专注日',
      colors: { c1: '#ff416c', c2: '#ff4b2b', c3: '#ff9a9e' },
      glowSize: '30px',
      pulseSpeed: '1s',
      emoji: '🔥',
    },
    intense: {
      name: '极限日',
      colors: { c1: '#8e2de2', c2: '#4a00e0', c3: '#00c6ff' },
      glowSize: '35px',
      pulseSpeed: '0.8s',
      emoji: '🌟',
    },
    legendary: {
      name: '超神日',
      colors: { c1: '#00c6ff', c2: '#0072ff', c3: '#ffffff' },
      glowSize: '50px',
      pulseSpeed: '0.5s',
      emoji: '💥',
    },
  };
});
