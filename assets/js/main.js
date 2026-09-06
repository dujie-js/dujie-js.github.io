// 入场动画辅助:给 .iUp 元素依次延迟加 .up 类(仅 up 被使用,其余方法已删)
const iUp = (function () {
  let time = 0;
  const duration = 150;
  return {
    up: function (element) {
      setTimeout(function () {
        element.classList.add('up');
      }, time);
      time += duration;
    },
  };
})();

// Bing image URL pattern: validates format and prevents CSS injection
const BING_IMAGE_URL_PATTERN =
  /^\/th\?id=OHR\.[a-zA-Z0-9_\-]+\.jpg(&[a-zA-Z0-9=._\-]+)*$/;

/**
 * Bing 壁纸 JSONP 回调(必须是全局函数,勿改名/勿移入 IIFE):
 * CI 的 bing.js 生成 assets/json/images.json,其内容为 'getBingImages([...])';
 * main.js 用 <script> 加载该文件,浏览器执行到该调用时回调本函数设置 #panel 背景。
 */
function getBingImages(imgUrls) {
  /**
   * 获取Bing壁纸
   * 先使用 GitHub Action 每天获取 Bing 壁纸 URL 并更新 images.json 文件
   * 然后读取 images.json 文件中的数据
   */
  const indexName = 'bing-image-index';
  const panel = document.querySelector('#panel');
  if (!panel || !imgUrls || !Array.isArray(imgUrls) || imgUrls.length === 0) {
    return;
  }
  const maxIndex = imgUrls.length - 1;
  let index = parseInt(sessionStorage.getItem(indexName), 10);
  if (!Number.isFinite(index) || index >= maxIndex) index = 0;
  else index++;
  const imgUrl = imgUrls[index];
  // 校验 URL 格式，防止 CSS 注入
  if (
    !imgUrl ||
    typeof imgUrl !== 'string' ||
    !imgUrl.match(BING_IMAGE_URL_PATTERN)
  ) {
    return;
  }
  // 转义引号与反斜杠后拼入 background 属性
  const url = 'https://cn.bing.com' + imgUrl.replace(/['\\]/g, '\\$&');
  panel.style.background = "url('" + url + "') center center no-repeat #666";
  panel.style.backgroundSize = 'cover';
  sessionStorage.setItem(indexName, index);
}

// 公众号弹窗(样式在 wakatime-theme.css)。
// 事件逻辑独立成块:不再泄漏 openWeChatModal/closeWeChatModal/wechatModal 全局名。
// 页面无弹窗(如未来复用本文件的其他页)时整块直接跳过。
(function () {
  const wechatModal = document.getElementById('wechatModal');
  if (!wechatModal) return;

  function open() {
    wechatModal.classList.add('open');
    wechatModal.hidden = false;
  }

  function close() {
    // 等待淡出过渡结束再隐藏(与 CSS transition 0.3s 一致)
    wechatModal.classList.remove('open');
    setTimeout(function () {
      if (!wechatModal.classList.contains('open')) {
        wechatModal.hidden = true;
      }
    }, 300);
  }

  // 公众号按钮打开弹窗
  const wechatBtn = document.getElementById('wechat-btn');
  if (wechatBtn) {
    wechatBtn.addEventListener('click', open);
    wechatBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  }

  // 点击遮罩关闭(图片自身点击由 stopPropagation 阻止冒泡)
  wechatModal.addEventListener('click', function (e) {
    if (e.target === wechatModal) close();
  });

  // Esc 关闭弹窗
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && wechatModal.classList.contains('open')) {
      close();
    }
  });
})();

document.addEventListener('DOMContentLoaded', function () {
  // 页脚年份(原 index.html 内联脚本,统一收口到本文件并做空保护)
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 动态加载 Bing 壁纸数据(带日期时间戳避免缓存;?cb= 是死参数已移除,
  // JSONP 回调函数名由 bing.js 输出约定,见 getBingImages 注释)
  const bingScript = document.createElement('script');
  bingScript.src =
    './assets/json/images.json?t=' + new Date().toISOString().slice(0, 10);
  document.body.appendChild(bingScript);

  // 获取一言数据(失败静默:页面保留静态默认鸡汤,不影响其余初始化)
  const xhr = new XMLHttpRequest();
  xhr.timeout = 10000;
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return;
    if (this.status !== 200) return;
    let res;
    try {
      res = JSON.parse(this.responseText);
    } catch (err) {
      console.error('Hitokoto JSON parse error:', err);
      return;
    }
    const descElement = document.getElementById('description');
    if (descElement && res.hitokoto && res.from) {
      // 使用文本节点渲染，防止 XSS
      const textNode = document.createTextNode(res.hitokoto);
      const br = document.createElement('br');
      const fromPrefix = document.createTextNode(' -「');
      const strong = document.createElement('strong');
      strong.textContent = res.from;
      const fromSuffix = document.createTextNode('」');
      descElement.innerHTML = '';
      descElement.appendChild(textNode);
      descElement.appendChild(br);
      descElement.appendChild(fromPrefix);
      descElement.appendChild(strong);
      descElement.appendChild(fromSuffix);
    }
  };
  xhr.open('GET', 'https://v1.hitokoto.cn', true);
  xhr.send();

  let iUpElements = document.querySelectorAll('.iUp');
  iUpElements.forEach(function (element) {
    iUp.up(element);
  });

  // 移动端菜单（监听在 span 容器上，支持键盘操作）
  const btnMobileMenu = document.querySelector('.btn-mobile-menu');
  const navigationWrapper = document.querySelector('.navigation-wrapper');

  if (btnMobileMenu && navigationWrapper) {
    btnMobileMenu.setAttribute('role', 'button');
    btnMobileMenu.setAttribute('tabindex', '0');
    btnMobileMenu.setAttribute('aria-label', '菜单');
    btnMobileMenu.setAttribute('aria-expanded', 'false');
    let isAnimating = false;

    const toggleMenu = function () {
      if (isAnimating) return;
      const isVisible = navigationWrapper.classList.contains('visible');

      if (isVisible) {
        isAnimating = true;
        const onAnimationEnd = function () {
          navigationWrapper.classList.remove('visible');
          navigationWrapper.classList.remove('animated');
          navigationWrapper.classList.remove('bounceOutUp');
          navigationWrapper.removeEventListener(
            'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend',
            onAnimationEnd,
          );
          isAnimating = false;
        };
        navigationWrapper.addEventListener(
          'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend',
          onAnimationEnd,
        );
        navigationWrapper.classList.remove('bounceInDown');
        navigationWrapper.classList.add('bounceOutUp');
      } else {
        navigationWrapper.classList.add('visible');
        navigationWrapper.classList.add('animated');
        navigationWrapper.classList.add('bounceInDown');
      }
      const iconOpen = btnMobileMenu.querySelector('.btn-mobile-menu__icon');
      const iconClose = btnMobileMenu.querySelector('.btn-mobile-close__icon');
      if (iconOpen && iconClose) {
        iconOpen.classList.toggle('hidden');
        iconClose.classList.toggle('hidden');
      }
      btnMobileMenu.setAttribute('aria-expanded', isVisible ? 'false' : 'true');
    };

    btnMobileMenu.addEventListener('click', toggleMenu);
    btnMobileMenu.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleMenu();
      }
    });
  }
});
