var fs = require('fs');
var _ = require('underscore')
var game = {
	czar:null
    , handCount: 10
	, state:"entry"
    , bcard:{
        text:""
        , pick:1
    }
    , entries:[]
    , players:[]
    , winner:{}
} // entry, vote, result

var bcards = ["This is the first card, did you shuffle?"]
var wcards = []


var init = function(cb){
	// read black cards, put into array
	fs.readFile('bcards.txt', function(err, data) {
	    if(err) throw err;
	    bcards = _.shuffle(data.toString().split("\n"));
	    // Shuffle
	    newRound()
	});

	// read white cards, put into array
	fs.readFile('wcards.txt', function(err, data) {
	    if(err) throw err;
	    wcards = _.shuffle(data.toString().split("\n"));
	});

    newRound()
	
}

var nextPlayer = function(player){

}

var newRound = function(){
	console.log("game.newRound")
    // Remove the current entries from the players
    for(index in game.players){
        var player = game.players[index]
        player.hand = _.difference(player.hand, game.entries)
        while(player.hand.length < game.handCount) player.hand.push(wcards.shift() || "END OF STACK")
    }
    // Find the next czar
    var czar = _.find(game.players, function(player){
        return player.id == game.czar
    })
    var czarIndex = _.indexOf(game.players, czar)
    game.czar = (czarIndex + 1 < game.players.length) ? game.players[czarIndex + 1] : game.players[0];

	
    // Pull the black card
	var text = bcards.shift()
	// Pick how many
	var count = text.match(/________/g)
	var pick = (count==null) ? 1 : count.length
	game.bcard = {
		text: text
		, pick: pick
	}
	console.log(game.bcard)
    game.entries = []
    game.state = "entry"
}

exports.join = function(id, cb){
	// Add a player, give them a hand
	var player = {
		id: id
		, name: ""
		, hand: wcards.splice(0,10)
		, score: 0
	}
	game.players.push(player)
    // If we don't have a czar, they are the czar
    if(!game.czar) game.czar = player.id
    cb(player)
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

exports.setName = function(id, name){
    var p = _.find(game.players, function(player){ return player.id == id })
    p.name = name
}

exports.addEntry = function(entry, cb){
    // Don't let czar vote
    if(entry.id == game.czar) return cb("You are the Czar");
    if(game.state != "entry") return cb("Not accepting entries");
	
    // Only 1 entry?
    if(_.any(game.entries, function(entryItem){ return entryItem.id == entry.id })){
        return cb("You have already submitted an entry.")
    }
    else{
        game.entries.push(entry)
        // Remove the player's white card
        // Give player a new white card
        return cb(null)
    }
}

exports.getEntries = function(){
    return game.entries
}

exports.vote = function(id, vote, cb){
    // Don't let czar vote
    if(vote.id == game.czar) return cb("You are not the Czar");
    if(game.state != "vote") return cb("Not accepting votes");
    
    // Set the winner
    var winner = _.find(game.players, function(player){
        return _.contains(player.hand, vote)
    })
    winner.score++
    game.winner = winner
    // Start new round
    newRound()
    // Hand out new white cards
    // Get next black card
    cb(false)
}

exports.getGame = function(){ return game }

exports.getScores = function(){
    return _.map(game.players, function(val, key){ return { id:val.id, name:val.name, score:val.score }; })
}

exports.getPlayers = function(){ return game.players }

exports.getEntries = function(){ return game.entries }

exports.getCzar = function(){ return game.czar }

exports.getState = function(){ return game.state }

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

exports.setState = function(id, state, cb){
    // Only czar may change state
    if(game.czar != id) return cb(false)
    
    // Only start new rounds when the last is done
    if(game.state != "result" && state == "entry") return cb(false)
    // entry, vote, result
    game.state = state
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
    return cb(true)
}

init()