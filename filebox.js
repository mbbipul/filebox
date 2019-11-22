var express = require('express');
var formidable = require('formidable');
var path = require('path');
var fs = require('fs');
var os = require('os');
var qr_image = require("qr-image");
const find = require('local-devices');
var network = require('network');
const bodyParser = require('body-parser');

const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/";

// MongoClient.connect(url, function(err, db) {
//     if (err) throw err;
//     var dbo = db.db("fileshare");
    
//     dbo.collection("sharing", function(err, res) {
//         if (err) throw err;
//         console.log("Collection delete!");
//         db.close();
//       });
// });
const clientIp = (req) => {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var requestIp = ip.split('::ffff:').join("");
    return requestIp;
};

MongoClient.connect(url, function(err, db) {
    if (err) throw err;
    var dbo = db.db("fileshare");
    
    dbo.createCollection("sharings", function(err, res) {
        if (err) throw err;
        console.log("Collection created!");
        db.close();
      });
});
/**
 * @param {string} basePath
 * @param {string} relativePath
 * @returns {Promise<Array<string>>}
 */
function recursiveReadDir(basePath) {
    return _readDirPromise(basePath).then((contents) => {
        return Promise.all(contents.map((fileOrDirName) => {
            let fileOrDirPath = path.join(basePath, fileOrDirName);
            return _isDirPromise(fileOrDirPath).then((isDir) => {
                if (isDir) {
                    return recursiveReadDir(fileOrDirPath);
                } else {
                    return [fileOrDirPath];
                }
            });
        }));
    })
    .then((arrayOfArrays) => {
        let result = [];
        for (let index = 0; index < arrayOfArrays.length; index++) {
            result.push(...arrayOfArrays[index]);
        }
        return result;
    })
}
function _readDirPromise(targetPath) {
    return new Promise((resolve) => {
        fs.readdir(targetPath, (err, contents) => {
            if (contents == null) {
                resolve([]);
            } else {
                resolve(contents.filter((fileName) => fileName[0] != '.'));
            }
        })
    });
}
function _isDirPromise(targetPath) {
    return new Promise((resolve) => {
        fs.lstat(targetPath, (err, stats) => {
            resolve(stats.isDirectory());
        });
    });
}

function normalizePort(val) {
    var port = parseInt(val, 10);
    
    if (isNaN(port)) {
        // named pipe
        return val;
    }
    
    if (port >= 0) {
        // port number
        return port;
    }
    
    return false;
}


module.exports = function (conf) {
    
    /*
        conf = {
            filesFolderPath:...,
            publicPath:...,
            port:...|8080,
            allowDeletion:false,
            progressCallback:...,
            errorCallback:...,
            progressThreshold:...|10,
            disable: {
                fileDownload:...|false,
                info:...|false
            }
        }
    */
    
    //Getting config from conf.
    var filesFolderPath = conf.filesFolderPath || path.join(__dirname, 'files'),
        publicPath = conf.publicPath || path.join(__dirname, 'public'),
        port = normalizePort(conf.port || '8080'),
        allowDeletion = conf.allowDeletion === true,
        progressCallback = conf.progressCallback || false,
        errorCallback = conf.errorCallback || false,
        progressThreshold = conf.progressThreshold || 10,
        disable = conf.disable || {};
    
    var interfaces = os.networkInterfaces();
    
    var addresses = [];
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            // NOTE: Only handling IPv4 at the moment.
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }

    let qrCodesPath = path.join(publicPath, "./qr_codes/");
    if (!fs.existsSync(qrCodesPath)){
        fs.mkdirSync(qrCodesPath);
    }
    addresses.forEach((address) => {
        let qr_svg = qr_image.image(`http://${address}:${port}/`, { type: 'png' });
        qr_svg.pipe(fs.createWriteStream(path.join(publicPath, `./qr_codes/${address}_${port}.png`)));
    });
    
    //New express app
    var app = express();
    
    //For index. Basically app.get('/',...);
    app.use(express.static(publicPath));
    app.set('views', __dirname + '/public/views');
    app.engine('html', require('ejs').renderFile);
    app.set('view engine', 'html');
    
    app.use(bodyParser.urlencoded({
      extended: true
    }));
    app.use(bodyParser.json())
    //For downloading files
    if(!disable.fileDownload) app.use('/f',express.static(filesFolderPath));

    app.get('/f/del/:filename',function(req, res) {
        
        if (allowDeletion) {
            var filename = req.params.filename

            try {
                fs.unlinkSync(`./files/`+filename)
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
                res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
                res.setHeader('Access-Control-Allow-Credentials', true); // If needed
                res.status(200)
                //file removed
            } catch(err) {
                err.status = 404;
                res.send(err);
            }    
        } else {
            res.sendStatus(500);
        }
        
    });

    app.get('/localdevices', function(req, res){
        
        find().then(devices => {
            var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            console.log(ip.split('::ffff:'));

            var path = require('path');
            var userName = process.env['USERPROFILE'].split(path.sep)[2];
            var computerName = process.env['COMPUTERNAME'];

            devices.computerName =  computerName;
            devices.userName = userName;
            network.get_gateway_ip(function(err, ip) {
                res.json([devices,ip]); // err may be 'No active network interface found.'
            });
        });
    });
    
    app.get('/clientip', function(req,res) {
        res.json(clientIp(req));
    });
    app.get("/chat",function(req,res){
        res.render('chat.html');
    });

    app.post('/editusername',function(req,res){
        console.log(req.body.username)
        MongoClient.connect(url, function(err, db) {
            if (err) throw err;
            var dbo = db.db("fileshare");
            
            dbo.createCollection("users", function(err, res) {
                if (err) throw err;
                var myobj = { username: req.body.username, userip:  clientIp(req)};
                dbo.collection("users").insertOne(myobj, function(err, res) {
                    if (err) throw err;
                    console.log(myobj);
                    db.close();
                });
              });
        });
    });

    app.post('/', function(req, res) {

        if (!!conf.filesFolderPath) {

            filesFolderPath.split(path.sep).reduce((currentPath, folder) => {
                currentPath += folder + path.sep;
                if (!fs.existsSync(currentPath)){
                    fs.mkdirSync(currentPath);
                }
                return currentPath;
            }, '');   
        } else {
            if (!fs.existsSync(filesFolderPath)){
                fs.mkdirSync(filesFolderPath);
            }
        }
       
        var form = new formidable.IncomingForm();
        
        form.parse(req);
        
        var finalName,
            progress;
        
        fields = [];
        form.on('field', function(field, value) {
            var ob = {};
            ob[field] = value;
            fields.push(ob);

        });
        form.on('fileBegin', function (name, file){
            
            progress = 0;
            
            fileName = file.name;
            var splitted = fileName.split(".");
            var extension, name;
            if(splitted.length > 1) {
                extension = splitted[splitted.length-1];
                name = "";
                for (var i = 0; i < splitted.length-1; i++) {
                    name += splitted[i];
                }
            } else {
                extension = "";
                name = fileName;
            }
            
            //For not overwriting files.
            var i = 0;
            while(fs.existsSync(path.join(filesFolderPath, fileName))){
                fileName = name + " dup" + (i++) + "." + extension;
            }
            
            file.path = path.join(filesFolderPath, fileName);
            file.finalName = fileName;
            var requestIp = clientIp(req);
            console.log(fields);
            var destId = fields[0].destip;
            var share = { filename : fileName,sharehostid : requestIp,destip  : destId};
            MongoClient.connect(url, function(err, db) {
                if (err) throw err;
                var dbo = db.db("fileshare");
                dbo.collection("sharings").insertOne(share, function(err, res) {
                    if (err) throw err;
                    console.log("1 document inserted");
                    db.close();
                  });
            });
            finalName = fileName;
            
        });
        
        form.on('file', function (name, file){
            res.redirect('/?success=' + encodeURIComponent(file.finalName));
        });
        
        form.on('error', function(err) {
            res.redirect('/?error=1');
        });
        
        form.on('progress', function (bytesReceived,bytesExpected) {
            var temp = bytesReceived * 100 / bytesExpected;
            if (temp > progress + progressThreshold) {
              progress = Math.floor(temp);
              if(progressCallback) progressCallback(progress,finalName);
            }
        });

    });
    
    app.get('/infowithfile',function(req, res) {

        if(disable.infowithfile) {
            var err = new Error('Not Found');
            err.status = 404;
            res.send(err);
            return;
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
        res.setHeader('Access-Control-Allow-Credentials', true); // If needed
        
        var infowithfile = {"addresses":addresses,"port":port,"allowDeletion":allowDeletion};
        
        if(disable.fileDownload){
            res.json(infowithfile);
            return;
        }
        
        recursiveReadDir(filesFolderPath).then((foundPaths) => {
            var requestIp = clientIp(req);
            MongoClient.connect(url, function(err, db) {
                if (err) throw err;
                var dbo = db.db("fileshare");
                var query = { $or: [ { destip: requestIp }, { destip: "all" } ] };
                dbo.collection("sharings").find(query).toArray(function(err, result) {
                  if (err) throw err;
                  if(addresses.includes(requestIp)){
                    infowithfile.fileList = foundPaths.map((foundPath) => {
                        return path.relative(filesFolderPath, foundPath);
                    });
                    res.json(infowithfile);

                  }else{
                    var fname = [];
                    result.forEach(element => {
                        fname.push(element.filename);
                    });
                    dbo.collection("sharings").find({ sharehostid: requestIp }).toArray(function(err, result) {
                        if (err) throw err;
                        result.forEach(element => {
                            fname.push(element.filename);
                        });
                        infowithfile.fileList = fname;
                        res.json(infowithfile);

                    });
                  }
                  db.close();
                });
            });

            
        })
        
    });
    
    // catch 404
    app.use(function(req, res, next) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });

    // development error handler
    app.use(function(err, req, res, next) {
        if(errorCallback) errorCallback(req.url, err);
        if (err.status == 404) {
            res.sendStatus(404);
        } else {
            res.sendStatus(500);
        }
    });
    
    app.set('port', port);

    return {
        "addresses":addresses,
        "app":app,
        "disable":disable, //For changing later.
        "port":port
    };
    
};
