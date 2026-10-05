import http from 'node:http';
import {readFile} from 'node:fs/promises';
http.createServer(async(req,res)=>{try{const file=(req.url==='/' || req.url==='/todo')?'tests/browser/fixture.html':req.url==='/yuvomi.js'?'custom_components/yuvomi/frontend/yuvomi.js':null;if(!file){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html':'text/javascript');res.end(await readFile(file));}catch{res.writeHead(500).end();}}).listen(8129,'127.0.0.1');
