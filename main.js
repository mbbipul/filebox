const http = require('http');
const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/";
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
    var servUser=[];
    if(typeof addr === 'string'){
        console.log('Listening on pipe ' + addr);
    } else {
        filebox.addresses.forEach(function (address) {
            var user = {
                ip: address,
                isActive : true,
                name : address.split(".").join(""),
                mac : "?"
            };
            servUser.push(user);
            console.log('Listening on ' + address + ':' + addr.port);
        });
    }
    MongoClient.connect(url, function(err, db) {
        if (err) throw err;
        var dbo = db.db("fileshare");
        
        dbo.collection("users").insertMany(servUser, function(err, res) {
            if (err) throw err;
            console.log("added server user");
            db.close();
          });

    });
}

server.listen(filebox.port);
server.on('error', onError);
server.on('listening', onListening);


//socket.io instantiation
const io = require("socket.io")(server)


//listen on every connection
io.on('connection', (socket) => {
	console.log('New user connected')

	//default username
	socket.username = "Anonymous"

    //listen on change_username
    socket.on('change_username', (data) => {
        socket.username = data.username;
        console.log("change username"+data.username);
    })

    //listen on new_message
    socket.on('new_message', (data) => {
        //broadcast the new message
        console.log("data recieved ")
        console.log(data);
        socket.emit('sending_message',data);
        io.sockets.emit('new_message'+data.recv,data );
    })

    //listen on typing
    socket.on('typing', (data) => {
        io.sockets.emit('typing'+data.recv,data );
    })
})
