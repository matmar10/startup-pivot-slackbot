'use strict';

var express = require('express'),
    bodyParser = require('body-parser'),
    RestClient = require('node-rest-client').Client,
    events = require('events'),
    sprintf = require("sprintf-js").sprintf;

var cachedIdeas = [],
    minCacheSize = 5,
    maxCacheSize = 20,
    startIdeaApiDelay = 2000,
    app = express(),
    eventEmitter = new events.EventEmitter(),
    restClient,
    server,
    companies = ['Gun', 'Electroloom', 'Blossom', 'Patter', 'BlockScore', 'Align', 'Critica', 'Trending.fm', 'Orboros', 'Palarin', 'BlockCypher',
        'Seeds', 'CareerDean', 'Honeybadgr', 'HashRabbit', 'Coin Hako', 'Atlas Card', 'WiFL', 'Hedgy', 'Coinmotion', 'Pylon', 'ZapChain', 'Follow The Coin'],
    getRandomCompany = function () {
        var min = 0,
            max = companies.length - 1,
            index = (Math.floor(Math.random() * (max - min + 1)) + min);
        return companies[index];
    },
    getIdea = function (callback) {
        var idea = cachedIdeas.shift();

        if (cachedIdeas.length <= minCacheSize) {
            eventEmitter.emit('needMoreIdeas');
        }

        console.log(idea);

        // respond with an idea
        return callback(idea['this'], idea['that']);
    };


restClient = new RestClient();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

restClient.registerMethod('getStartupIdea', 'http://itsthisforthat.com/api.php?json', 'GET');

eventEmitter.on('needMoreIdeas', function () {
    // console.log('Will now refill the ideas cache...');
    // cache needs to be filled
    var intervalId = setInterval(function () {

        // fill the cache back up to the desired size
        if(cachedIdeas.length >= maxCacheSize) {
            clearInterval(intervalId);
            eventEmitter.emit('ideasCacheFilled');
        }

        restClient.methods.getStartupIdea(function(data, response) {

            var idea = JSON.parse(data);

            if(200 !== response.statusCode) {
                console.log('Error fetching startup idea...');
                console.log(response);
                return;
            }
            // console.log('Got an idea! A startup that is like ' + idea['this'] + ' for ' + idea['that']);
            cachedIdeas.push(idea);
        });

    }, startIdeaApiDelay);
});


app.post('/slackbot/inbound/pivot', function (req, res) {
    var userName = (req.body.user_name) ? '@' + req.body.user_name : 'y\'all';
    getIdea(function (properNoun, forMarket) {
        res.send(200, {
            text: sprintf('*Thinking of pivoting, %s?* How about %s for %s', userName, properNoun, forMarket),
            parse: 'full'
        });
    });

});

server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});

eventEmitter.emit('needMoreIdeas');
