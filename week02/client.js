const net  = require('net');

class ResponseParser{
    constructor(){
        this.WAITING_STATUS_LINE = 0;
        this.WAITING_STATUS_LINE_END = 1;
        this.WAITING_HEADER_NAME = 2;
        this.WAITING_HEADER_SPACE = 3;
        this.WAITING_HEADER_VALUE = 4;
        this.WAITING_HEADER_LINE_END = 5;
        this.WAITING_HEADER_BLOCK_END = 6;
        this.WAITING_BODY = 7;

        this.current = this.waitingStatusLine;
        this.statusLine = "";
        this.headers = {};
        this.headerName = "";
        this.headerValue = "";
        this.bodyParser = null;
    }

    get isFinished(){
        return this.bodyParser && this.bodyParser.isFinished;
    }

    get response(){
        this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/);
        return {
            statusCode: RegExp.$1,
            statusText: RegExp.$2,
            headers: this.headers,
            body: this.bodyParser.content.join('')
        }
    }

    receive(string){
        for(let i=0; i < string.length; i++){
            this.receiveChar(string.charAt(i));
        }
        console.log('end receive');
    }
    receiveChar(char){
        this.current = this.current(char);
        // if(this.current === end){
        //     return 'end';
        // }
    }
    waitingStatusLine(char){
        if(char === '\r'){
            return this.waitingStatusLineEnd
        }else{
            this.statusLine += char;
            return this.waitingStatusLine
        }
    }
    waitingStatusLineEnd(char){
        if(char === '\n'){
            return this.waitingHeaderName
        }else{
            return this.waitingStatusLineEnd
        }
    }
    waitingHeaderName(char){
        if(char === ':'){
            return this.waitingHeaderSpace;
        }else if(char === '\r'){
            if(this.headers["Transfer-Encoding"] === "chunked"){
                this.bodyParser = new TrunkedBodyParser();
            }
            return this.waitingHeaderBlockEnd;
        }
        else{
            this.headerName += char;
            return this.waitingHeaderName;
        }
    }
    waitingHeaderSpace(char){
        if(char === ' '){
            return this.waitingHeaderValue;
        }else{
            return this.waitingHeaderSpace;
        }
    }
    waitingHeaderValue(char){
        if(char === '\r'){
            this.headers[this.headerName] = this.headerValue;
            this.headerName = '';
            this.headerValue = '';
            return this.waitingHeaderLineEnd;
        }else{
            this.headerValue += char;
            return this.waitingHeaderValue
        }
    }
    waitingHeaderLineEnd(char){
        if(char === '\n'){
            return this.waitingHeaderName;
        }else{
            return this.waitingHeaderLineEnd;
        }
    }
    waitingHeaderBlockEnd(char){
        if(char === '\n'){
            return this.waitingBody;
        }else{
            this.waitingHeaderBlockEnd;
        }
    }
    waitingBody(char){
        console.log('body ==', char);
        this.bodyParser.receiveChar(char);
        if(this.isFinished){
            return this.end
            console.log('body end ===');
        }else{
            return this.waitingBody;
        }
        //return this.end;
    }
    end(){
        return this.end;
    }
}

class TrunkedBodyParser{
    constructor(){
        this.WAITING_LENGTH = 0;
        this.WAITING_LENGTH_LINE_END = 1;
        this.READING_TRUNK = 2;
        this.WAITING_NEW_LINE = 3;
        this.WAITING_NEW_LINE_END = 4;
        this.length = 0;
        this.content = [];
        this.isFinished = false;
        this.current = this.waitingLength;
    }
    receiveChar(char){
        this.current = this.current(char);
    }
    waitingLength(char){
        if(char === '\r'){
            if(this.length === 0){
                this.isFinished = true;
            }
            return this.waitingLengthLineEnd;
        }else{
            this.length *= 16;
            this.length += parseInt(char, 16);
            return this.waitingLength;
        }
    }
    waitingLengthLineEnd(char){
        if(char === '\n'){
             return this.readingTrunk;
        }else{
            return this.waitingLengthLineEnd;
        }
    }
    readingTrunk(char){
        this.content.push(char);
        this.length--;
        if(this.length === 0){
            return this.waitingNewLine;
        }else{
            return this.readingTrunk;
        }
    }
    waitingNewLine(char){
        if(char === '\r'){
            return this.waitingNewLineEnd;
        }else{
            return this.waitingNewLine;
        }
    }
    waitingNewLineEnd(char){
        if(char === '\n'){
            return this.waitingLength;
        }else{
            return this.waitingNewLineEnd;
        }
    }
}

class Request{
    constructor(options){
        this.method = options.method || "GET";
        this.host = options.host;
        this.port = options.port || "8080";
        this.path = options.path || "/";
        this.body = options.body || {};
        this.headers = options.headers || {};
        if(!this.headers["Content-Type"]){
            this.headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
        if(this.headers["Content-Type"] === "application/json"){
            this.bodyText = JSON.stringify(this.body);
        }else if(this.headers["Content-Type"] === "application/x-www-form-urlencoded"){
            this.bodyText = Object.keys(this.body).map(key => `${key}=${encodeURIComponent(this.body[key])}`).join('&');
            this.headers['Content-Length'] = this.bodyText.length;
        }
    }
    send(connection){
        return new Promise((resolve, reject) =>{
            // ...
            const parser = new ResponseParser;
            if(connection){
                connection.write(this.toString());
            }else{
                connection = net.createConnection({
                    host: this.host,
                    port: this.port
                }, ()=>{
                    const connectionWrite = this.toString();
                    connection.write(connectionWrite);
                });
                connection.on('data', (data) =>{
                    console.log('connect back data ==', data);
                    parser.receive(data.toString());
                    if(parser.isFinished){
                        resolve(parser.response);
                        connection.end();
                    }
                })
                connection.on('error', (error) =>{
                    reject(error);
                    connection.end();
                    console.log('connect error ==', error);
                })
            }
            resolve("");
        })
    }
    toString(){
        return `${this.method} ${this.path} HTTP/1.1\r
${Object.keys(this.headers).map(key => `${key}: ${this.headers[key]}`).join('\r\n')}\r
\r
${this.bodyText}`
    }
}

void async function(){
    let request = new Request({
        method: 'POST',
        host: '127.0.0.1',
        port: '8080',
        headers: {
            ["X-Foo2"]: "customed"
        },
        body: {
            name: "maxionghui"
        }
    })
    const response = await request.send();
    console.log('my response ==', response);
}();
