const https = require('https')
const fs = require('fs')

const options = {
  hostname: 'www.bing.com',
  port: 443,
  path: '/HPImageArchive.aspx?format=js&idx=0&n=8',
  method: 'GET'
}

const req = https.request(options, bing_res => {
  let bing_body = [], bing_data = {};
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
    let img_array = bing_data.images;
    if (!img_array || !Array.isArray(img_array)) {
      console.error('Unexpected Bing API response format');
      process.exit(1);
    }
    let img_url = [];
    img_array.forEach(img => {
      img_url.push(img.url);
    });
    var jsonpStr = "getBingImages(" + JSON.stringify(img_url) + ")";
    fs.writeFile('./assets/json/images.json', jsonpStr, (err) => {
      if (err) {
        console.error('Failed to write images.json:', err);
        process.exit(1);
      }
      console.log("JSON data is saved: " + jsonpStr);
    });
  });
})

req.on('error', error => {
  console.error(error)
})

req.end()