const https = require('https');
const fs = require('fs');
const path = require('path');

// 不依赖 CWD:从任何目录执行都写到仓库内同一位置
const OUT_FILE = path.resolve(__dirname, '../../assets/json/images.json');

const options = {
  hostname: 'cn.bing.com',
  port: 443,
  path: '/HPImageArchive.aspx?format=js&idx=0&n=8',
  method: 'GET',
};

const req = https.request(options, (bing_res) => {
  let bing_body = [],
    bing_data = {};
  bing_res.on('data', (chunk) => {
    bing_body.push(chunk);
  });
  bing_res.on('end', () => {
    try {
      bing_body = Buffer.concat(bing_body);
      bing_data = JSON.parse(bing_body.toString());
    } catch (e) {
      console.error('Failed to parse Bing API response:', e.message);
      process.exit(1);
    }
    const img_array = bing_data.images;
    if (!img_array || !Array.isArray(img_array) || img_array.length === 0) {
      // 空数组同样要退出非 0:否则 CI 会把可用的 images.json 覆盖成空列表,
      // 前端静默降级、壁纸全消失,而工作流却是绿的。
      console.error('Unexpected Bing API response format');
      process.exit(1);
    }
    const img_url = img_array
      .map((img) => img && img.url)
      .filter((url) => typeof url === 'string' && url.length > 0);
    if (img_url.length === 0) {
      console.error('Bing API returned no usable image url');
      process.exit(1);
    }
    const jsonpStr = 'getBingImages(' + JSON.stringify(img_url) + ')';
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFile(OUT_FILE, jsonpStr, (err) => {
      if (err) {
        console.error('Failed to write images.json:', err);
        process.exit(1);
      }
      console.log('JSON data is saved: ' + jsonpStr);
    });
  });
});

req.on('error', (error) => {
  if (error && error.message === 'timeout') {
    console.error('Bing API request timed out after 15s');
  } else {
    console.error(
      'Failed to fetch Bing API:',
      error && error.message ? error.message : error,
    );
  }
  process.exit(1);
});

req.setTimeout(15000, () => {
  req.destroy(new Error('timeout'));
});

req.end();
