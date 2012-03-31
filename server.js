var paperboy = require('paperboy');
var http = require('http');
var path = require('path');
var swallow = require('swallow');

WEBROOT = path.join(path.dirname(__filename), 'site');

var server = http.createServer(function(req, res) {
  paperboy
    .deliver(WEBROOT, req, res)
     .addHeader('Cache-Control', 'no-cache')
    .otherwise(function(err) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end("Error 404: File not found");
    });    
});
server.listen(process.env.PORT || 8000);

swallow.build({
  in: './assets',
  out: './site/assets.json'
}, function() {
  console.log('Built assets');
});
