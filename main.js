const http = require('http');
const fs =require('fs');
var SSE = require('sse');

var filebox = require('./filebox')({
    filesFolderPath: (process.argv[3] || null),
    port: (process.argv[2] || process.env.PORT),
    allowDeletion: false,
    progressCallback: function(progress, fileName) {
        //TODO: connect to UI when writing the electron app.
        console.log("Progress: "+fileName+" "+Math.floor(progress)+"%");
       
    },
    errorCallback: function (url, err) {
        if (err.status == 404) {
            console.log("(Not Found) " + url);
        } else {
            console.log("(errorCallback) " + url);
            console.error(err);   
        }
    }
});

var server = http.createServer(filebox.app);

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }
    
    var bind = typeof port === 'string'
    ? 'Pipe ' + filebox.port
    : 'Port ' + filebox.port;
    
    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
        console.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
        case 'EADDRINUSE':
        console.error(bind + ' is already in use');
        process.exit(1);
        break;
        default:
        throw error;
    }
}

function onListening() {
    var addr = server.address();
    try{
        var sourceUrls = "file.json";
        fs.unlinkSync(sourceUrls);
    }catch(err){
        console.log(err);
    }
    fs.writeFileSync('file.json', JSON.stringify(""));

    if(typeof addr === 'string'){
        console.log('Listening on pipe ' + addr);
    } else {
        filebox.addresses.forEach(function (address) {
            console.log('Listening on ' + address + ':' + addr.port);
        });
    }
}

server.listen(filebox.port);
server.on('error', onError);
server.on('listening', onListening);