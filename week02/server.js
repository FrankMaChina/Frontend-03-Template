const http = require("http")

http.createServer((req,res)=>{
    let body = [];
    req.on('error', (error)=>{
        console.log('request on error =', error);
    }).on('data', (chunk) =>{
        //console.log('get data ===', chunk.toString());
        body.push(chunk);
        console.log('back ===', body);
    }).on('end', ()=>{
        body = Buffer.concat(body).toString();
        console.log('end body: ', body);
        res.writeHead(200, {"Content-Type": "text/html"});
        res.end('Hello World\n');
    })
}).listen(8080);

console.log('my server started');