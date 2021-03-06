var twilio = require('./twiliorest.js')
var apis = require('./apis.js')

var fs = require('fs');
var _ = require('underscore')
var game = {
	czar:null
    , location: "http://www.mapquestapi.com/staticmap/v3/getmap?key=Fmjtd%7Cluua20utnh%2Cbs%3Do5-967au6&size=800,600&zoom=7&type=map&center=47.50513,-122.11048"
    , handCount: 10
	, state:"entry"
    , bcard:{
        text:"INITIAL"
        , pick:1
    }
    , entries:[]
    , players:[]
    , winner:{
        name:''
        , wcard:''
        , bcard:''
        , id:''
    }
} // entry, vote, result
var host = ""
var calls = []

var bcards = ["This is the first card, did you shuffle?"]
var wcards = []
var names = []

var init = function(cb){
    fs.readFile('adjectives.txt', function(err, data) {
        if(err) throw err;
        bcards = _.shuffle(data.toString().split("\n"));
        // Shuffle
        newRound()
    });


    apis.guardian(function(err, data){
        if(!err)
            wcards = _.union(wcards, data)  
        apis.rovi(function(err, data){
            if(!err)
                wcards = _.union(wcards, data)  
            apis.espn(function(err, data){
                if(!err)
                    wcards = _.union(wcards, data) 
                wcards = _.shuffle(wcards)
            })

        })

    })

	// read black cards, put into array
	// fs.readFile('bcards.txt', function(err, data) {
	//     if(err) throw err;
	//     bcards = _.shuffle(data.toString().split("\n"));
	//     // Shuffle
	//     newRound()
	// });

	// read white cards, put into array
	// fs.readFile('wcards.txt', function(err, data) {
	//     if(err) throw err;
	//     wcards = _.shuffle(data.toString().split("\n"));
	// });

    fs.readFile('names.txt', function(err, data) {
        if(err) throw err;
        names = _.shuffle(data.toString().split("\n"));
        // Shuffle
        newRound()
    });
	
}

newRound = function(callback){
	// Remove the current entries from the players
    for(index in game.players){
        var player = game.players[index]
        player.hand = _.difference( player.hand, game.entries )
        while(player.hand.length < game.handCount) player.hand.push(wcards.shift() || "END OF STACK")

        game.players[index] = player
    }
    // Find the next czar
    var czar = _.find(game.players, function(player){
        return player.id == game.czar
    })
    var czarIndex = _.indexOf(game.players, czar)
    var nextCzar = (czarIndex + 1 < game.players.length) ? game.players[czarIndex + 1] : game.players[0];
    game.czar = (nextCzar) ? nextCzar.id : null
	
    // Pull the black card
	var text = bcards.shift()
	// Pick how many
	var count = text.match(/________/g)
	var pick = (count==null) ? 1 : count.length
	game.bcard = {
		text: text
		, pick: pick
	}
	game.entries = []
    game.state = "entry"
    for (x in calls) { twilio.updateCall(calls[x], 'http://' + host + '/twilio/voice') }
}

exports.join = function(uuid, cb){
    if(!uuid) {
        cb("UUID not found")
        return
    }
    var player = _.find(game.players, function(player){ return player.id == uuid })
    if( typeof player === 'undefined'){
        var player = {
            id: uuid
            , name: names.shift() || uuid
            , hand: wcards.splice(0,10)
            , score: 0
            , status: 'active'
        }
        game.players.push(player)
    }
    // If we don't have a czar, they are the czar
    if(!game.czar) game.czar = player.id
    cb(null, {players: game.players, czar: game.czar})
}

exports.leave = function(id){
    
    // Remove their player
    var player = _.find(game.players, function(player){ return player.id == id })
    game.players = _.without(game.players, player)

    // If person is czar, new czar
    if(game.czar == player.id) {
        game.czar = null;
        if(game.players.length > 0)
            game.czar = game.players[0].id
    }

    // Remove their entry
    var entry = _.find(game.entries, function(entry){ return entry.id == id })
    game.entries = _.without(game.entries, entry)

}

exports.getEntries = function(){
    return game.entries
}

exports.getGame = function(){ return game }

exports.getScores = function(){
    return _.map(game.players, function(val, key){ return { id:val.id, name:val.name, score:val.score }; })
}

exports.getPlayers = function(){ return game.players }

exports.getPlayer = function(uuid){ return _.find(game.players, function(player){ return player.id == uuid })}

exports.getEntries = function(){ return game.entries }

exports.getCzar = function(){ return game.czar }

exports.getState = function(){ return game.state }

exports.getBcard = function(){ return game.bcard }

exports.getWinner = function(){ return game.winner }

exports.getScoreboard = function(){
	// Subtract the czar
	return {
        czar: game.czar
        , scores: _.map(game.players, function(val, key){ return { id:val.id, name:val.name, score:val.score }; })
		, players: game.players.length
		, entries: game.entries.length
	}

}

exports.pushCall = function(callSid){
    calls = _.union(calls, [callSid])
}

exports.deleteCall = function(callSid){
    calls = _.without(calls, callSid)
}

exports.setHost = function(h){
    if(!host) host = h
}

exports.setLocation = function(loc){
    game.location = "http://www.mapquestapi.com/staticmap/v3/getplacemap?key=Fmjtd%7Cluua20utnh%2Cbs%3Do5-967au6&location=" + loc + "&size=800,600&type=map&zoom=7&imagetype=jpeg&showicon=green-1"
}

exports.setName = function(id, name, cb){
    var p = _.find(game.players, function(player){ return player.id == id })
    if(p) p.name = name
    cb(null, { players: game.players, czar: game.czar })
}

exports.setState = function(id, state, cb){
    // Only czar may change state
    if(game.czar != id) return cb("Only Czar may change state")
    
    // Only start new rounds when the last is done
    if(game.state != "result" && state == "entry") return cb("Only start new rounds when the last is done")

    // Only end the entry round when there are entries
    if(game.state == "entry" && state == "vote" && game.entries.length == 0) return cb("Must have at least one entry")

    // entry, vote, result
    game.state = state
    for (x in calls) { twilio.updateCall(calls[x], 'http://' + host + '/twilio/voice') }

    if(state=="entry"){ // New round
        // Set the state
        game.state = "entry"
        game.entries = []
        game.votes = []
        game.help = "Enter a phrase whose acronym matches the above letters."
    }
    else if (state == "vote")
        game.help = "Pick your favorite phrase (not your own) from the list below"
    else if (state == "result")
        game.help = "The round has ended.  Click 'New Round' to begin."
    else
        game.help = "";
    return cb(null, { state: game.state, czar: game.czar })
}

exports.addEntry = function(id, entry, cb){
    // Don't let czar vote
    if(id == game.czar) return cb("You are the Czar");
    if(game.state != "entry") return cb("Not accepting entries");
    
    // Only 1 entry?
    var player = _.find(game.players, function(player){ return player.id == id })
    game.entries = _.difference(game.entries, player.hand)
    game.entries.push(entry)
    return cb(null, { entries: game.entries, czar: game.czar, players: game.players, state: game.state })
}

exports.setVote = function(id, vote, cb){
    // Don't let czar vote
    if(vote.id == game.czar) return cb("You are not the Czar");
    if(game.state != "vote") return cb("Not accepting votes");
    
    // Set the winner
    var winningPlayer = _.find(game.players, function(player){
        return _.contains(player.hand, vote)
    })
    winningPlayer.score++
    var winner = {
        name: winningPlayer.name
        , bcard: game.bcard.text
        , wcard: vote
        , id: winningPlayer.id
    }
    game.winner = winner
    // Start new round
    newRound()
    cb(null, game)
    // Hand out new white cards
    // Get next black card
}

init()