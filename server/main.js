var express = require('express');
var Promise = require('bluebird');
var request = Promise.promisify(require('request'));
var fs = Promise.promisifyAll(require('fs'));
var readFile = Promise.promisify(require('fs').readFile);
var path = require('path');
var app = express();

const api_key = "5C419535AC2011881FB0C33C06FF39AB";
const cache_path = "game_cache/";

var mustacheExpress = require('mustache-express');
app.engine('html',mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/../views');

// respond with "hello world" when a GET request is made to the homepage
app.get('/', function (req, res) {
  fs.writeFile('test','test');
  if("user_name" in req.query) {
    steamRequest("ISteamUser","ResolveVanityURL","v0001",{
      vanityUrl: req.query.user_name
    }).then(function (response) {
        if(response.success == 1) {
          var steamId = response.steamid;
          steamRequest("IPlayerService","GetOwnedGames","v0001", {
            steamid: steamId,
            include_appinfo: 1
          }).then(function (response) {
            var gameCount = response.game_count;
            var unplayed = 0;
            var barelyPlayed = 0;
            var gamePromises = [];
            var gameList = [];
            for(var i in response.games) {
              var game = response.games[i];
              var playTime = game.playtime_forever;
              if(playTime == 0) {
                unplayed++;
              } else if (playTime > 0 && playTime < 30) {
                barelyPlayed++;
              }
              var promise = getGameDetails(game.appid);
              promise.then(function (gameData) {
                console.log(gameData);
                gameList.push(gameData);
              });
              gamePromises.push(promise);
            }
            Promise.all(gamePromises).then(function () {
              res.render('games-list.html', {
                user_name: req.query.user_name,
                steam_id: steamId,
                game_count: gameCount,
                unplayed: unplayed,
                barely_played: barelyPlayed,
                game_list: gameList
              });
            });
          });

        } else {
          res.render('not-found.html', {
            user_name: req.query.user_name
          });
        }

    });

  } else {
    res.render('index.html');
  }

});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})

function getGameDetails (appId) {
  var storeUrl = "http://store.steampowered.com/api/appdetails/?appids=";
  return new Promise(function (resolve, reject) {
    if(fs.existsSync(cache_path + appId)) {
      readFile(cache_path + appId).then(function (data) {
        resolve(JSON.parse(data)[appId]);
      });
    } else {
      request(storeUrl + appId).then(function (result) {
        console.log('############ APP ID ##########');
        console.log(appId);
        var gameDetails = JSON.parse(result.body)[appId];
        resolve(gameDetails);
        fs.writeFile(cache_path + appId,result.body);
      });
    }
  });
};

function steamRequest(interface,method,version,args) {
  var baseUrl = "http://api.steampowered.com/";
  var url = baseUrl + interface + "/" + method + "/" + version;
  var argString = "?key=" + api_key;
  for (var property in args) {
    argString += "&" + property + "=" + args[property];
  }
  console.log('requesting: ',url + argString);
  var p = new Promise(function (resolve, reject) {
    console.log('request start');
    request(url + argString).then(function (result) {
      resolve(JSON.parse(result.body).response);
    });
  });
  return p;

}
