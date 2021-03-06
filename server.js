var server = {}

var http = require('http');
var express = require('express');
var io = require('socket.io');
var pty = require('pty.js');
var terminal = require('term.js');

var socket;
var term;
var buff = [];

server.run = function (options) {

    // create shell process
    term = pty.fork(
        process.env.SHELL || 'sh',
        [],
        {
            name: require('fs').existsSync('/usr/share/terminfo/x/xterm-256color')
                ? 'xterm-256color'
                : 'xterm',
            cols: 80,
            rows: 24,
            cwd: process.env.HOME
        }
    );

    // store term's output into buffer or emit through socket
    term.on('data', function (data) {
        return !socket ? buff.push(data) : socket.emit('data', data);
    });

    console.log('Created shell with pty master/slave pair (master: %d, pid: %d)', term.fd, term.pid);

    var app = express();
    var server = http.createServer(app);

    // let term.js handle req/res
    app.use(terminal.middleware());


    //set the template engine ejs
    app.set("view engine", "ejs");

    //middlewares
    app.use(express.static("public"));
    app.use(express.static("node_modules"));

    //routes
    app.get("/", (req, res) => {
        res.render("index");
    });

    // let server listen on the port
    options = options || {};
    server.listen(options.port || 8080, () => { console.log('Server is run at port', options.port || 8080) });

    // let socket.io handle sockets
    io = io.listen(server, { log: false });

    io.sockets.on('connection', function (s) {
        console.log('an user connected!');
        // when connect, store the socket
        socket = s;

        // handle incoming data (client -> server)
        socket.on('data', function (data) {
            console.log(data);
            term.write(data);
        });

        // handle connection lost
        socket.on('disconnect', function () {
            socket = null;
        });

        // send buffer data to client
        while (buff.length) {
            socket.emit('data', buff.shift());
        };
    });
};


//server.run({port: 8080});

// export server object
module.exports = server;