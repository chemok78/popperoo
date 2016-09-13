var express = require("express");
//load express module
require("dotenv").config({
  silent: true
});
//Dotenv outputs a warning to your console if missing a .env file. Suppress this warning using silent.
var path = require("path");
//use node.js native path module to work with files and paths
var bodyParser = require("body-parser");
//load bodyParser module to parse incoming request bodies, under req.body
var mongodb = require("mongodb");
//use native mongoDB drive
var ObjectID = mongodb.ObjectID;
//load ObjectID method so we can generate new objectId (using objectId = new ObjectID)
//ObjectId is a 12-byte BSON type
//MongoDB uses ObjectIds as the default value of _id field of each document which is generated while creation of any document
var Yelp = require('yelp');
//load Yelp node.js module

var yelp = new Yelp({

  consumer_key: process.env.oauth_consumer_key,
  consumer_secret: process.env.oauth_consumer_secret,
  token: process.env.oauth_token,
  token_secret: process.env.oauth_token_secret

});


var VENUES_COLLECTION = "venues";
//Set the variable VENUES_COllECTION to the string "venues" to use in mLabs

var app = express();
//create instance of express

/*Express Middleware*/
app.use(express.static(__dirname + "/public"));
//use express middleware for serving static files from public folder (relative to public folder)
app.use(bodyParser.json());
//parse all requests as JSON in the app instance

//global database variable outside of database connection callback to reuse outside of express app
var db;

mongodb.MongoClient.connect(process.env.DB_URL, function(err, database) {
  //connect to the database with node native MongoDB driver, before launching express app server

  if (err) {
    //handle DB connection error

    console.log(err);

    process.exit(1);
    //exit Node JS using global process with failure code 1 (0 is success code, when no more async operations are pending)
    //1 is uncaught fatal exception

  }

  db = database;
  //save global db variable as database instance
  console.log("successfully connected to database");

  var server = app.listen(process.env.PORT || 8080, function() {

    var port = server.address().port;
    console.log("App is now running on port", port);

  });

  /*RESTFUL API Web services*/

  function handleError(res, reason, message, code) {
    //generic error handling function used by all endpoints

    console.log("ERROR: " + reason);

    res.status(code || 500).json({
      "error": message
    });
    //send a status response of the code parameter or 500 if not given

  }

  /*Yelp API endpoints*/

  app.get("/search/:location", function(req, res) {
    //send GET http request to Yelp API with the locatio as req.params.location
    //called from Venues service in Angular JS, getVenues method

    yelp.search({
        location: req.params.location,
        limit: 20,
        category_filter: 'bars'
      })
      //see https://www.yelp.com/developers/documentation/v2/search_api for the options
      //https://www.yelp.com/developers/documentation/v2/all_category_list for list of all the categories
      .then(function(data) {
        //gets data from Yelp and when ready sends in back to front end

        res.status(200).json(data);

      })
      .catch(function(err) {

        console.error(err);

      });

  }); //app.get("/search/:location", function(req, res) 


}); //mongodb.MongoClient.connect