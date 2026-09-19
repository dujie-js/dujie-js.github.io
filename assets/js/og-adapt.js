/**
 * og-adapt.js — 社交元数据域名自适应
 *
 * 页面 OG 标签(canonical/og:url/og:image)为静态硬编码(爬虫要求绝对 URL)。
 * 当站点被部署到与硬编码不同的域名时(如启用自定义域名),本脚本自动将
 * 分享/跳转使用的元数据修正为当前域名,避免漏改静态文件导致分享出错误链接。
 *
 * 注意:爬虫不执行 JS,仍读取静态值;本脚本服务于真实用户的浏览器分享。
 * 换域名时建议仍按 README 清单同步静态文件(workflow 的 SITE_URL + 4 处 og 标签)。
 */
(function () {
    'use strict';
    var hardcoded = 'https://dujie-js.github.io';
    // file:// 下 location.origin 是字符串 "file://"(非空),不显式判断协议就会继续执行,
    // 把 canonical / og:url 改写成 file:///... 这类垃圾值。
    if (window.location.protocol === 'file:') return;
    var origin = window.location.origin;
    // 域名一致或环境异常时无需处理
    if (!origin || origin === 'null' || origin === hardcoded) return;

    var base = origin + window.location.pathname.replace(/index\.html$/, '');

    // canonical
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.getAttribute('href') && canonical.getAttribute('href').indexOf(hardcoded) === 0) {
        canonical.setAttribute('href', base);
    }

    // og:url / og:image
    ['og:url', 'og:image'].forEach(function (prop) {
        var el = document.querySelector('meta[property="' + prop + '"]');
        if (el && el.getAttribute('content') && el.getAttribute('content').indexOf(hardcoded) === 0) {
            el.setAttribute('content', prop === 'og:image' ? origin + '/assets/img/myLogo.jpg' : base);
        }
    });
})();
