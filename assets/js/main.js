var iUp = (function () {
	var time = 0,
		duration = 150,
		clean = function () {
			time = 0;
		},
		up = function (element) {
			setTimeout(function () {
				element.classList.add("up");
			}, time);
			time += duration;
		},
		down = function (element) {
			element.classList.remove("up");
		},
		toggle = function (element) {
			setTimeout(function () {
				element.classList.toggle("up");
			}, time);
			time += duration;
		};
	return {
		clean: clean,
		up: up,
		down: down,
		toggle: toggle
	};
})();

function getBingImages(imgUrls) {
	/**
	 * 获取Bing壁纸
	 * 先使用 GitHub Action 每天获取 Bing 壁纸 URL 并更新 images.json 文件
	 * 然后读取 images.json 文件中的数据
	 */
	var indexName = "bing-image-index";
	var index = sessionStorage.getItem(indexName);
	var panel = document.querySelector('#panel');
	if (isNaN(index) || Number(index) === 7) index = 0;
	else index++;
	var imgUrl = imgUrls[index];
	var url = "https://www.cn.bing.com" + encodeURI(imgUrl);
	panel.style.background = "url('" + url + "') center center no-repeat #666";
	panel.style.backgroundSize = "cover";
	sessionStorage.setItem(indexName, index);
}

function decryptEmail(encoded) {
	var address = atob(encoded);
	window.location.href = "mailto:" + address;
}

document.addEventListener('DOMContentLoaded', function () {
	// 获取一言数据
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function () {
		if (this.readyState === 4 && this.status === 200) {
			var res = JSON.parse(this.responseText);
			document.getElementById('description').innerHTML = res.hitokoto + "<br/> -「<strong>" + res.from + "</strong>」";
		}
	};
	xhr.open("GET", "https://v1.hitokoto.cn", true);
	xhr.send();

	var iUpElements = document.querySelectorAll(".iUp");
	iUpElements.forEach(function (element) {
		iUp.up(element);
	});

	var avatarElement = document.querySelector(".js-avatar");
	avatarElement.addEventListener('load', function () {
		avatarElement.classList.add("show");
	});

	// 移动端菜单
	const btnMobileMenu = document.querySelector('.btn-mobile-menu__icon');
	const navigationWrapper = document.querySelector('.navigation-wrapper');

	if (btnMobileMenu && navigationWrapper) {
		let isAnimating = false;

		btnMobileMenu.addEventListener('click', function () {
			if (isAnimating) return;

			if (navigationWrapper.classList.contains('visible')) {
				isAnimating = true;
				const onAnimationEnd = function () {
					navigationWrapper.classList.remove('visible');
					navigationWrapper.classList.remove('animated');
					navigationWrapper.classList.remove('bounceOutUp');
					navigationWrapper.removeEventListener('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', onAnimationEnd);
					isAnimating = false;
				};
				navigationWrapper.addEventListener('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', onAnimationEnd);
				navigationWrapper.classList.remove('bounceInDown');
				navigationWrapper.classList.add('bounceOutUp');
			} else {
				navigationWrapper.classList.add('visible');
				navigationWrapper.classList.add('animated');
				navigationWrapper.classList.add('bounceInDown');
			}
			btnMobileMenu.classList.toggle('icon-list');
			btnMobileMenu.classList.toggle('icon-angleup');
			btnMobileMenu.classList.toggle('animated');
			btnMobileMenu.classList.toggle('fadeIn');
		});
	}
});
