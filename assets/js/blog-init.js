/**
 * blog-init.js — 博客各页面统一的初始化入口。
 *
 * 原 blog/index.html、blog/post.html、about/index.html 各自内联一段
 * "BlogNav.init(); BlogPost.init(); …",重复三份;现收口到本文件。
 * 各模块 init() 内部已对缺失元素做空返回(博客列表页找不到 #post-content 等),
 * 因此这里在每页调用全部 5 个 init 也安全。
 *
 * 必须放在 blog.js 之后加载(window.BlogNav 等暴露接口依赖其先执行)。
 */
(function () {
  var MODULES = ['BlogNav', 'BlogIndex', 'BlogSearch', 'BlogPost', 'BlogBackToTop'];
  MODULES.forEach(function (name) {
    var mod = window[name];
    if (mod && typeof mod.init === 'function') {
      try {
        mod.init();
      } catch (err) {
        console.error('[' + name + '.init]', err);
      }
    }
  });
})();
