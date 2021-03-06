import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';

export const Games = new Mongo.Collection('games')

export const game_rules_template = {
  '5' : {'num_evil_players' : 2, '4th_turn' : false,
    'players_per_turn' : [2, 3, 2, 3, 3]
    },
  '6' : {'num_evil_players' : 2, '4th_turn' : false,
    'players_per_turn' : [2, 3, 4, 3, 4]
    },
  '7' : {'num_evil_players' : 2, '4th_turn' : true,
    'players_per_turn' : [2, 3, 3, 4, 4]
    },
  '8' : {'num_evil_players' : 3, '4th_turn' : true,
    'players_per_turn' : [3, 4, 4, 5, 5]
    },
  '9' : {'num_evil_players' : 3, '4th_turn' : true,
    'players_per_turn' : [3, 4, 4, 5, 5]
    },
  '10' : {'num_evil_players' : 4, '4th_turn' : true,
    'players_per_turn' : [3, 4, 4, 5, 5]
    },
}

if (Meteor.isServer) {
  // This code only runs on the server
  Meteor.publish('games', function tasksPublication() {
    return Games.find();
    //some sort of handling here
  });

}

Meteor.methods({
  'interface.newGame'(user){
    //create new code
    //TODO - random words replace code
    function makeid() {
      var text = "";
      var possible = "abcdefghijklmnopqrstuvwxyz0123456789";
      for (var i = 0; i < 4; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
      return text;
    }
    //check if user is in game?

    //create game
    gamecode = makeid()
    Games.insert({
      type: 'game',
      createdAt: new Date(),
      code : gamecode,
      owner : Meteor.userId(),
      players : [],
      playerOrder : [],
      acceptingnewplayers : true,
      inprogress: 'false',
      archived: 'false',
      currentTurn : 0,
      turnRecords: [],
      currentScore : {'good' : 0, 'evil' : 0, display : []},
      pass_fail_round : false
    })
    //add creator to game as a user
    Meteor.call('interface.joinGame',gamecode, Meteor.userId())
  },
  'interface.joinGame'(gamecode, userID){
    var game = Games.find({code : gamecode});
    //check if game is still accepting new players and isnt archived
    if (game.acceptingnewplayers == false){
      console.log("this game isn't accepting new players");
      return;
    }
    //see if player is any other game
    if (Games.find({players: {$elemMatch: { playerID:userID }}}).count() == 0){
      user = Meteor.users.findOne({_id : userID});
      Games.update(
        {code : gamecode},
        {$addToSet:
          { players: {
            'playerID' : userID,
            'username' : user.username,
            'role' : '',
            'secretRole' : 'good'
        }}})
    }
    else{
      console.log('player already exists in game');
    }
  },
  'interface.beginGame'(gamecode, userID){
    game = Games.findOne({code : gamecode});
    //doesn't start unless there are 5 or more players
    if (game.players.length < 5){
      console.log("there are less than 5 players. Game won't start.");
      return;
    }
    var randon_num = function(limit){
      //returns a random number between 0-limit
      return Math.floor(Math.random() *limit);
    }
    // assign random  turn roles
    var players = game.players;
    var r = randon_num(game.players.length);
    for (i=0; i<game.players.length; i++){
      var role = 'voter';
      if (i == r){ role = 'leader' }
      players[i].role = role;
    }
    // randmize player order

    // assign random secret roles
    var rules = game_rules_template[game.players.length];
    var evil_players_index = []
    //selects random player indexes
    for (i = 0; i <= rules.num_evil_players-1; i++){
      var r = randon_num(game.players.length);
      while (evil_players_index.indexOf(r) > -1){
        r = randon_num(game.players.length);
      }
      evil_players_index.push(r);
    }
    //assigns evil roles to random players
    for (i = 0; i < evil_players_index.length; i++){
      players[evil_players_index[i]].secretRole = 'evil';
    }
    //assigns merlin to a player
    var r = randon_num(game.players.length);
    while (evil_players_index.find(x => x == r)){
      r = randon_num(game.players.length);
    }
    players[i].secretRole = 'merlin';
    //update DB
    Games.update(
      {code : gamecode},
      {$set : {
          acceptingnewplayers : false,
          inprogress : true,
          players : players,
          turnRules : rules
        }
      }
    );
    Meteor.call('interface.advanceTurn',gamecode, Meteor.userId())
  },
  'interface.advanceTurn'(gamecode, userID){
    var game = Games.findOne({code : gamecode});
    //could use some validation

    //only works if everyone has voted

    //updates score

    //chooses next roles
    var players = game.players;
    var new_leader_index = undefined;
    var old_leader_index = undefined;
    for (i=0; i<game.players.length; i++){
      if (players[i].role == 'leader'){
        new_leader_index = (i + 1) % game.players.length;
        old_leader_index = i;
      }
    }
    players[old_leader_index].role = 'voter';
    players[new_leader_index].role = 'leader';
    //updates db
    var new_turn_number = game.currentTurn + 1
    Games.update(
      {code : gamecode},
      {
        $set : {
          currentTurn: new_turn_number,
          players : players
        },
        $push: {
          turnRecords : {
            turn_number : new_turn_number,
            result : '',
            votes : [],
            pass_fail_votes : []
           }
        }
      }
    );
  },
  'interface.shufflePlayers'(gamecode, userID){
      //could use some validation
      var player_list = [];
      // loop through player list
//      for (var player in game.players){
//        player_list.push(player.username);
//      }
//      shuffle_players = function(array){
        // brute force DO NOT USE  long arrays / todo: make cooler/faster
//        var new_array = [];
//        while (new_array.length < array.length  ){
//          //randum number between 0 and length of player array
//          var random_index = Math.floor(Math.random() * array.length);
//          if (!new_array.includes(array[random_index])){
//            new_array.push(array[random_index]);
//          }
//        };
//        return new_array
//      };
      game = Games.findOne({code : gamecode});
      Games.update(
       {code : gamecode},
         {$set :
          { playerOrder : shuffle_players(player_list) }
        }
      );
  },
  'action.submitParty'(array, gamecode){
    Meteor.call('addValueToTurnRecords', gamecode, array);
 },
 'vote_on_pass_fail'(gamecode, value){
   var game = Games.findOne({code : gamecode});
   var player = game.players.find(x => x.playerID === Meteor.userId());
   var current_turn_num = game.currentTurn
   var current_turn = game.turnRecords.find(x => x.turn_number === game.currentTurn);
   if (current_turn.pass_fail_votes.find(x => x.playerID === Meteor.userId()) !== undefined){
     //looks to see if vote from player is already in votes, doesn't write to db;
     console.log('you cannot change your vote.')
     return;
   }
   var player_vote = {
    'playerID' : player.playerID,
    'username' : player.username,
    'vote' : value
   }
   Games.update(
     {code : gamecode, "turnRecords.turn_number" : current_turn_num},
     {$push: {  "turnRecords.$.pass_fail_votes" : player_vote } }
   );
   //redefine current_turn after votes have been added
   current_turn = Games.findOne({code : gamecode}).turnRecords.find(x => x.turn_number === game.currentTurn);
   //checks to see if this is the last vote  advances turn
   var proposal = current_turn.votes.find(x => x.role === 'leader');
   if (current_turn.pass_fail_votes.length >= proposal.proposal.length){
     //calculate if the vote passes
     var votes_yes = 0;
     var votes_no = 0;
     for (i = 0; i < current_turn.pass_fail_votes.length; i++){
       if (current_turn.pass_fail_votes[i].vote == 'yes'){
         votes_yes++;
       }
       else if (current_turn.pass_fail_votes[i].vote == 'no'){
         votes_no++;
       }
     }
     var result = '';
     console.log('votes yes' + votes_yes + ' votes no: ' + votes_no);
     if (votes_no == 0){
       result = 'Good wins a point! The party succeeds!'
       Games.update(
         {code : gamecode},
         {
           $inc: { "currentScore.good" : 1 },
           $push: { "currentScore.display" : 'good'}
         }
       );
     }
     else{
       result = votes_no + ' members of the party caused the round to fail. Evil wins a point.'
       Games.update(
         {code : gamecode},
         {
            $inc: {  "currentScore.evil" : 1 },
            $push: { "currentScore.display" : 'evil'}
          }
       );
     }
     Games.update(
       {code : gamecode, "turnRecords.turn_number" : current_turn_num},
       {$set: {  "turnRecords.$.result" : result } }
     );
     Games.update(
       {code : gamecode},
       {$set: {  "pass_fail_round" : false } }
     );
     //check for end game conditions
     var game = Games.findOne({code : gamecode});

     if (game.currentScore.evil >= 3){
       //game ends, evil wins
       console.log('evil wins.');
       //update db to archive game with result
       //"Play again? plus timer"
     }
     else if (game.currentScore.good >= 3){
       //game ends, good wins
       console.log('good wins.');
     }
     Meteor.call('interface.advanceTurn',gamecode, Meteor.userId());
   }
 },
 'addValueToTurnRecords'(gamecode, value){
  var game = Games.findOne({code : gamecode});
  var player = game.players.find(x => x.playerID === Meteor.userId());
  var current_turn_num = game.currentTurn;
  var current_turn = game.turnRecords.find(x => x.turn_number === game.currentTurn);
  if (current_turn.votes.find(x => x.playerID === Meteor.userId()) !== undefined){
    //looks to see if vote from player is already in votes, doesn't write to db;
    console.log('you cannot change your vote.')
    return;
  }
  var player_vote = {
   'role' : player.role,
   'playerID' : player.playerID,
   'username' : player.username
  }
  if (player.role == 'leader'){
   player_vote['proposal'] = value;
  }
  else{
   player_vote['vote'] = value;
  }
  Games.update(
    {code : gamecode, "turnRecords.turn_number" : current_turn_num},
    {$push: {  "turnRecords.$.votes" : player_vote } }
  );
  //redefine current_turn after votes have been added
  current_turn = Games.findOne({code : gamecode}).turnRecords.find(x => x.turn_number === game.currentTurn);
  //checks to see if this is the last vote => advances turn
  if (current_turn.votes.length >= game.players.length){
    //calculates current score
    var votes_yes = 0;
    var votes_no = 0;
    //could use a switch here instead
    for (i = 0; i < current_turn.votes.length; i++){
      if (current_turn.votes[i].vote == 'yes'){
        votes_yes++;
      }
      else if (current_turn.votes[i].vote == 'no'){
        votes_no++;
      }
      else{
        //console.log('neither yes nor no was found in votes?');
        //do nothing
      }
    }
    if (votes_yes > votes_no){
      //yes wins, vote passes
      //moves into submit pass/fail cards phase
      Games.update(
        {code : gamecode},
        {$set: {  "pass_fail_round" : true } }
      );
    }
    else if (votes_no >= votes_yes){
      //no wins, vote doesn't pass
      //stays in voting phase, moves to next round
      Games.update(
        {code : gamecode, "turnRecords.turn_number" : current_turn_num},
        {$set: {  "turnRecords.$.result" : 'no consensus' } }
      );
      //advance turn
      Meteor.call('interface.advanceTurn',gamecode, Meteor.userId());
    }
    else{
      console.log("you shouldn't see this error, this means that something weird happened with the votes.")
    }
  }
 }


});
