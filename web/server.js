'use strict';

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

// Get the content of the env JSON file
const data = JSON.parse(fs.readFileSync("/var/www/html/kel234-twitch-bot-js/conf/env.json", 'utf-8'));

var client_id = data.spotify.client_id;
var client_secret = data.spotify.client_secret;
var redirect_uri = data.spotify.redirect_uri;

let db = new sqlite3.Database('/var/www/html/kel234-twitch-bot-js/conf/kel234_bot_db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the in-memory SQlite database.');
});

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
    .use(cors())
    .use(cookieParser())
    .use(bodyParser.urlencoded({extended: true}));

app.get('/login', function (req, res) {
  // You should use one of line depending on type of frontend you are with
  res.sendFile(__dirname + '/public/index.html'); //if html file is root directory
});

/**
 * Route used for user connection.
 */
app.post('/login', function (req, res) {

    /**
     * Log user
     * @type {string}
     */
    let username = req.body.username;
    let password = req.body.password;

    let sql = 'SELECT username, password FROM login WHERE username = :username';

    // get all users matching username
    db.all(sql, {
        ':username': username
    }, (error, rows) => {
        if (!rows) {
            res.status(401);
            res.redirect('/#' + querystring.stringify({
                error: 'bad_credentials'
            }));
        }
        // receives all the results as an array
        rows.forEach(function (row) {
            if (row.username === username && row.password === password) {
                // redirect to /spotify route, user successfully logged in
                res.redirect('/spotify');
            } else {
                res.status(401);
                res.redirect('/#' + querystring.stringify({
                    error: 'bad_credentials'
                }));
            }
        })
    });
});

/**
 * Route used as Spotify authorize request.
 */
app.get('/spotify', function (req, res) {
    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // your application requests authorization
    var scope = 'user-read-private user-read-email playlist-modify-public playlist-modify-private user-modify-playback-state';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
})

/**
 * Route used as callback of Spotify authorize request.
 */
app.get('/callback', function (req, res) {

    // your application requests refresh and access tokens
    // after checking the state parameter

    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie(stateKey);
        var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
            },
            json: true
        };

        request.post(authOptions, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                var access_token = body.access_token,
                    refresh_token = body.refresh_token;

                fs.writeFile('/var/www/html/kel234-twitch-bot-js/conf/token.txt', access_token, function (err) {
                    if (err) return console.log(err);
                });

                // we can also pass the token to the browser to make requests from there
                res.redirect('https://bot.kel234.storagehost.ch/web/public/dashboard.html#' +
                    querystring.stringify({
                        access_token: access_token,
                        refresh_token: refresh_token
                    }));
            } else {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    }));
            }
        });
    }
});

/**
 * Route used for token refresh.
 */
app.get('/refresh_token', function (req, res) {

    // requesting access token from refresh token
    var refresh_token = req.query.refresh_token;
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))},
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            let access_token = body.access_token;

            // write new token in text file
            fs.writeFile('/var/www/html/kel234-twitch-bot-js/conf/token.txt', access_token, function (err) {
                if (err) return console.log(err);
            });

            res.send({
                'access_token': access_token
            });
        }
    });
});

console.log('Listening on 8888');
app.listen(8888);
