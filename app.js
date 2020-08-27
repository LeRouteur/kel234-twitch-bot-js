'use strict';

const fetch = require("node-fetch");
global.fetch = fetch;
global.Headers = fetch.Headers;

const tmi = require("tmi.js");
const fs = require('fs');
const winston = require('winston');
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: {service: 'user-service'},
    transports: [
        //
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        //
        new winston.transports.File({filename: './log/error.log', level: 'error'}),
        new winston.transports.File({filename: './log/combined.log'}),
    ],
});
const request = require('request');
const axios = require('axios');

//TODO LIST
//
//- Récupérer la nouvelle clé d'authentification automatiquement toutes les heures dans "function requestToken()"
//
//- Trouver pourquoi ça met le message "Musique trouvée" alors que la musique n'existe pas et parfois l'inverse...
//
//- Essayer de refresh le token à chaque changement -> https://developer.spotify.com/documentation/general/guides/authorization-guide/ (part 2)

// Get the content of the env JSON file
const data = JSON.parse(fs.readFileSync("./conf/env.json"));

//Environement Settings

// TWITCH PART
//var username = data.twitch.username;
//var twitchToken = data.twitch.twitch_token;
var username = data.twitch.username;
var twitchToken = data.twitch.twitch_token;
var channel = data.twitch.channel;

// SPOTIFY PART
var clientId = data.spotify.client_id;
var clientSecret = data.spotify.client_secret;
var redirectUri = data.spotify.redirect_uri;
var scope = data.spotify.scope;

const client = new tmi.Client({
    options: {debug: true},
    connection: {
        reconnect: true,
        secure: true
    },
    identity: {
        username: username,
        password: twitchToken
    },
    channels: [channel]
});
client.connect().catch(console.error);

// Register our event handlers (defined below)
client.on("message", onMessageHandler);
client.on("connected", onConnectedHandler);

function getToken() {
    try {
        return fs.readFileSync('conf/token.txt', 'utf-8');
    } catch (e) {
        logger.log('error', 'Error while reading the token text file: ' + e.stack);
    }
}

function getUri() {
    try {
        return fs.readFileSync('conf/uri.txt', 'utf-8');
    } catch (e) {
        logger.log('error', 'Error while reading the URI text file: ' + e.stack);
    }
}

// Prise de chaque message qui entre
function onMessageHandler(target, context, msg, self) {
    if (self) {
        return;
    } // Ignore messages from the bot

    const commandName = msg.trim();

    if (commandName === "!test") {
        client.say(target, `Test réussi!`);
        console.log(`* Commande ${commandName} exécutée`);
    } else if (commandName === "!discord") {
        client.say(
            target,
            "L'adresse de mon Discord est https://cutt.ly/discord-kel234 :) Si le lien vient à ne pas fonctionner, envoie moi un MP Discord ;) Mon pseudo : kel234#0799 :)"
        );
        console.log(`* Commande ${commandName} exécutée`);
    } else if (commandName === "!commands_bot") {
        client.say(
            target,
            `Les commandes actuellement disponibles sont !hello, !vip, !modo, !discord et !multi`
        );
        console.log(`* Commande ${commandName} exécutée`);
    } else if (commandName === "!hello") {
        client.say(target, `Hey! comment vas-tu?`);
        console.log(`* Commande ${commandName} exécutée`);
    } else if (commandName === "!vip") {
        client.say(
            target,
            `Pour devenir VIP de la chaine, il vous faut être sur le discord et également avoir 20'000 points de chaine :) Si ces deux critères sont remplis, je vous mettrai VIP ;) PS : Votre présence peut aussi aider Kappa`
        );
        console.log(`* Commande ${commandName} exécutée`);
    } else if (commandName === "!modo") {
        client.say(
            target,
            `Seules les personnes en qui j'ai une entière confiance sont modérateurs/modératrices ici ;) Pour devenir modo, ça va être compliqué du coup ;P Mais qui sait, vous pourriez vous retrouver avec une épée à côté de votre pseudo un jour...`
        );
        console.log(`* Commande ${commandName} exécutée`);
    } else if (commandName === "!multi") {
        client.say(
            target,
            `Pour voir mon live et celui de Phantom en meme temps, il vous suffit d'aller sur https://multistre.am/lebazarduphantom/kel234/layout4/`
        );
    } else if (commandName === "!english") {
        client.say(
            target,
            `Yes, I'm speaking French but if you speak English, don't hesitate to write and I'll answer you ;)`
        );
    } else if (commandName.startsWith("!sr") === true) {
        let accessToken = getToken();
        testSong(commandName, accessToken);

        let uri = getUri();

        if (uri) {
            // song found, add it to playlist
            //console.log(accessToken)
            let result = addToQueue(uri, accessToken);
            console.log(result)
            if (result) {
                client.say(
                    target,
                    `Votre musique a été trouvée et sera jouée dans quelques instants :)`
                );
            } else {
                logger.log('error', 'Error while searching for Spotify track data');
                client.say(target, 'Erreur! Avertissez-moi :)');
            }
        } else {
            logger.log('error', 'Error while searching for Spotify track data');
            client.say(
                target,
                `Votre musique n'a pas été trouvée... :/ Réessayez ;)`
            );
        }

        console.log(`* Commande !sr executée`);
    }
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler(addr, port) {
    console.log(`Connected to ${addr}:${port}`);
}

function testSong(song, accessToken) {
    let song1;
    let song2;

    song1 = song.replace("!sr", "");
    song2 = song1.trim();

    var uri = "";

    axios.get('https://api.spotify.com/v1/search?q=' + encodeURIComponent(song2) + '&type=track&market=CH&limit=1', {
        headers: {
            Authorization: 'Bearer ' + accessToken
        }
    })
        // handle success
        .then(function (response) {
            uri = response.data.tracks.items[0].uri;
            fs.writeFileSync('conf/uri.txt', uri, function (err) {
                if (err) {
                    return console.log(err);
                } else {
                    response = true;
                }
            });
            logger.log('info', 'Successfully obtained URI for track ' + song2);
        })
        // handle error
        .catch(function (error) {
            logger.log('error', 'Error while accessing Spotify.');
            return error;
        });
}

"!sr ava max salt"

function addToQueue(uri, access_token) {

    let playlistId = "1UlJQWQApYaiwO89GpG80z";

    axios.post('https://api.spotify.com/v1/playlists/' + encodeURIComponent(playlistId) + "/tracks?uris=" + encodeURIComponent(uri), "", {
        headers: {
            'Authorization': 'Bearer ' + access_token
        }
    })
        // handle success
        .then(function (response) {
            logger.log('info', "Song with URI " + uri + " added in playlist with ID " + playlistId);
        })
        // handle error
        .catch(function (error) {
            logger.log('error', 'Error while accessing Spotify.');
            console.log(error.response.data);
        }).then(function () {
            return true;
    })
}
