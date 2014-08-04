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
    tickerPattern = new RegExp('^(BTC|btc)\:[a-zA-Z]{3}'),
    app = express(),
    eventEmitter = new events.EventEmitter(),
    restClient,
    server,
    companies = ['Gun', 'Electroloom', 'Blossom', 'Patter', 'BlockScore', 'Align', 'Critica', 'Trending.fm', 'Orboros', 'Palarin', 'BlockCypher',
        'Seeds', 'CareerDean', 'Honeybadgr', 'HashRabbit', 'Coin Hako', 'Atlas Card', 'WiFL', 'Hedgy', 'Coinmotion', 'Pylon', 'ZapChain', 'Follow The Coin'],
    wearables = {
        devices: ['bracelet', 'e-cigarette', 'headset', 'pair of earbuds', 'pair of glasses','armband', 'watch','wristband','smartpill','handbag','t-shirt', 'temporary tattoo',  'sports bra', 'pair of shoes', 'pair of trainers', 'jumper', 'pair of sandals', 'pair of trousers', 'Pair of sunglasses', 'ankle band', 'heart rate monitor', 'umbrella', 'moneyclip'],
        actions: ['tweets', 'sends you an email', 'posts to facebook', 'texts your mom', 'chimes', 'throbs', 'glows red', 'flashes', 'turns the central heating on', 'instagrams a selfie', 'glows green', 'vibrates', 'self destructs', 'twinkles', 'makes a vine', 'posts to medium', 'pulsates', 'quivers', 'trembles', 'undulates', 'blinks', 'glistens', 'swtiches the telly on', 'unlocks your computer'],
        triggers: ['you overeat','you do 50 press ups','you run 10k','you have a pint at lunch','you need a shit','you spend all your wages', 'you have nightmares', 'you fall asleep on the nightbus', 'your train is late', 'your ex is in the building', 'it\'s going to rain', 'it\'s windy', 'your boss is coming', 'it\'s sunny outside', 'george osborne cries', 'it\'s going to snow', 'you burn 100 calories', 'your sleep patterns change', 'there\'s 10% off at asos', 'the cat needs feeding', 'the dog needs letting out', 'the kids need picking up', 'your bus is due', 'someone logs into your facebook account', 'you run out of milk', 'you need to get more teabags', 'you drink too much coffee', 'you\'ve got a hangover', 'you leave the iron on']
    },
    getRandomInteger = function (min, max) {
        return (Math.floor(Math.random() * (max - min + 1)) + min);
    },
    getRandomCompany = function () {
        var min = 0,
            max = companies.length - 1,
            index = getRandomInteger(min, max);
        return companies[index];
    },
    getIdea = function (callback) {
        var idea = cachedIdeas.shift();

        if (cachedIdeas.length <= minCacheSize) {
            eventEmitter.emit('needMoreIdeas');
        }

        // respond with an idea
        return callback(idea['this'], idea['that']);
    },
    getRandomWearableIdea = function (callback) {
        var deviceIndex = getRandomInteger(0, wearables.devices.length),
            actionIndex = getRandomInteger(0, wearables.actions.length),
            triggerIndex = getRandomInteger(0, wearables.triggers.length);
        callback(wearables.devices[deviceIndex], wearables.actions[actionIndex], wearables.triggers[triggerIndex]);
    },
    containsOneOf = function (text, words) {
        for(var i = 0; i < words.length; i++) {
            if(-1 !== text.indexOf(words[i])) {
                return true;
            }
        }

        return false;
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
            cachedIdeas.push(idea);
        });

    }, startIdeaApiDelay);
});

app.post('/slackbot/inbound/:keyword', function (req, res) {

    var userName = (req.body.user_name) ? '@' + req.body.user_name : 'y\'all',
        messageText = req.body.text,
        company = getRandomCompany(),
        toCurrency;

    switch (req.params.keyword) {
        case 'pivot':
            getIdea(function (properNoun, forMarket) {
                res.send(200, {
                    text: sprintf('Speaking of *pivot* %s, did you hear the rumor that %s has pivoted to a %s for %s?', userName, company, properNoun, forMarket),
                    parse: 'full'
                });
            });
            break;

        case 'wearable':
            getRandomWearableIdea(function (device, action, trigger) {
                res.send(200, {
                    text: sprintf('*Need a wearable device strategy, %s?* What if %s made a %s that %s when %s.', userName, company, device, action, trigger),
                    parse: 'full'
                });
            });
            break;

        case 'ticker':

            toCurrency = tickerPattern.test(req.body.text) ? req.body.text.substring(4, 7).toUpperCase() : 'USD';

            restClient.get(sprintf('https://api.bitcoinaverage.com/ticker/global/%s/', toCurrency), {}, function(data, response) {
                if (200 !== response.statusCode) {
                    res.send(400, {
                        text: sprintf('Invalid currency %s', toCurrency)
                    });

                    console.log(response);
                    console.log(data);
                    return;
                }

                res.send(200, {
                    text: sprintf('*BTC:%s* - Ask: %f | Bid: %f | Last: %f', toCurrency, data.ask, data.bid, data.last),
                    parse: 'full'
                });
            });
            break;

        case 'joke':

            // your momma jokes
            if (containsOneOf(messageText, ['mom', 'momma', 'yo momma', 'mamma'])) {

                restClient.get('http://api.yomomma.info', {
                    'Accept': 'application/json'
                }, function(data, response) {

                    var stripped = data.substring(data.indexOf('<body>') + 6, data.indexOf('</body>')),
                        parsed = JSON.parse(stripped);

                    var handleError = function () {
                        res.send(400, {
                            text: sprintf('Could not get chuck norris joke')
                        });
                        console.log(response);
                        console.log(data);
                    };

                    if (200 !== response.statusCode) {
                        handleError();
                        return;
                    }

                    res.send(200, {
                        text: parsed.joke
                    });
                });
                break;
            }

            // chuck norris jokes
            if (containsOneOf(messageText, ['chuck', 'norris', 'CHUCK', 'NORRIS', 'Chuck', 'Norris'])) {

                restClient.get('http://api.icndb.com/jokes/random?limitTo=[nerdy]', {}, function(data, response) {
                    var handleError = function () {
                        res.send(400, {
                            text: sprintf('Could not get chuck norris joke')
                        });
                        console.log(response);
                        console.log(data);
                    };

                    if (200 !== response.statusCode) {
                        handleError();
                        return;
                    }

                    if ('success' !== data.type) {
                        handleError();
                        return;
                    }

                    res.send(200, {
                        text: data.value.joke
                    });
                });
                break;
            }

            // default

            res.send(200, {
                text: '*Usage*: `joke:[type]` - available types are: `chuck norris|chuck`, `yo momma|momma` *DISCLAIMER*: _Use of this Bot is at your own risk and subject to an agreement between you ("User") and the provider of this joke bot ("Jokester"). Jokester does not provide any warranty with regard to joke content ("Jokes"), quality, or appropriateness. Jokester cannot guarantee any level of humor whether stated or implied. By using this bot, User consents and agrees to absolve Jokester of any and all liability whatsoever related to the jokes presented herewith entirely whatsoever ab initio et ad infinitum._',
                parse: 'full'
            });
            break;

        default:
            res.send(404, {
                error: sprintf('No keyword %s is configured.', req.params.keyword)
            });
            break;
    }

});

var port = (process.argv.length === 3) ? process.argv[2] : 3000;

server = app.listen(port, function() {
    console.log('Listening on port %d', server.address().port);
});

eventEmitter.emit('needMoreIdeas');

