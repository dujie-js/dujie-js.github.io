const iUp = (function () {
  let time = 0;
  const duration = 150;
  const clean = function () {
    time = 0;
  };
  const up = function (element) {
    setTimeout(function () {
      element.classList.add('up');
    }, time);
    time += duration;
  };
  const down = function (element) {
    element.classList.remove('up');
  };
  const toggle = function (element) {
    setTimeout(function () {
      element.classList.toggle('up');
    }, time);
    time += duration;
  };
  return {
    clean: clean,
    up: up,
    down: down,
    toggle: toggle,
  };
})();

// Bing image URL pattern: validates format and prevents CSS injection
const BING_IMAGE_URL_PATTERN =
  /^\/th\?id=OHR\.[a-zA-Z0-9_\-]+\.jpg(&[a-zA-Z0-9=._\-]+)*$/;

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

function showWeChatModal() {
  const modal = document.getElementById('wechatModal');
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
  }, 10);
}

function closeWeChatModal() {
  const modal = document.getElementById('wechatModal');
  modal.style.opacity = '0';
  modal.style.visibility = 'hidden';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

// Esc 关闭弹窗
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById('wechatModal');
    if (modal && modal.style.display === 'flex') {
      closeWeChatModal();
    }
  }
});

document.addEventListener('DOMContentLoaded', function () {
  // 动态加载 Bing 壁纸数据（带日期时间戳，避免浏览器缓存导致壁纸不更新）
  const bingScript = document.createElement('script');
  bingScript.src =
    './assets/json/images.json?cb=getBingImages&t=' +
    new Date().toISOString().slice(0, 10);
  document.body.appendChild(bingScript);

  // 获取一言数据
  const xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
      const res = JSON.parse(this.responseText);
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
