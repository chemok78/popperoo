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
var passport = require('passport');
//load passport.js
var FacebookStrategy = require('passport-facebook').Strategy;
//load passport.js Facebook strategy
var session = require('express-session');
//load express session
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
app.use(session({
  secret: 'keyboard cat'
}));
//use express sessions in Express app
app.use(passport.initialize());
//initialize passport and use it in the app
app.use(passport.session());
//initialize passport sessions and use it in the app 

//global database variable outside of database connection callback to reuse outside of express app
var db;

/*Passport JS middleware*/

passport.use(new FacebookStrategy({
  //use Facebook Strategy with passport.js  

  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: process.env.FACEBOOK_CALLLBACK_DEV

}, function(accessToken, refreshToken, profile, done) {
  //callback function after sucessfull login

  process.nextTick(function() {

    done(null, profile);
    //return user profile after login
    // If the credentials are valid, the verify callback invokes done to supply Passport with the user that authenticated.

  });


}));

passport.serializeUser(function(user, done) {
  //save user object in session
  //result of serializeUser is attached to the session as req.session.passport.user = {};   
  //http://stackoverflow.com/questions/27637609/understanding-passport-serialize-deserialize

  done(null, user);
  //can also be done(null,user.id) if you want to save only the id

});

passport.deserializeUser(function(id, done) {
  //retrieve with the key given as obj parameter
  //the fetched object will be attached to req.user

  done(null, id);

});

/*Facebook Routes*/

app.get('/auth/facebook', passport.authenticate('facebook'));
//Authenticate with Passport when hitting this route

app.get('/auth/facebook/callback', passport.authenticate('facebook', {
  //Handle callback after successfully authenticated woth Facebook  

  successRedirect: '/',
  failureRedirect: '/error'

}));

app.get('/success', function(req, res, next) {

  res.send('You have successfully logged in. You can now close this window');

});

app.get('/error', function(req, res, next) {


  res.send("Error logging in");


});

//Middleware function to check if user is authenticated, to be used in every secured route

var auth = function(req, res, next) {

  if (!req.isAuthenticated()) {
    //if user is not authenticated send a 401 response status code
    //Every 401 will be intercepted by $httpProvider.interceptors in Angular Frontend

    console.log("You need to login!");

    res.sendStatus(401);

  } else {
    //if user is authenticated move on to next middleware function in stack  

    console.log("You logged in!");

    next();

  }


};

app.get('loggedin', function(req, res) {
  //Route to test if user is logged in, called from Angular front-end

  if (req.isAuthenticated()) {

    res.send(req.user);

  } else {

    res.send('0');

  }


});


mongodb.MongoClient.connect(process.env.DB_URL, function(err, database) {
  //connect to the database with node native MongoDB driver, before launching express app server

  var venuesSave = [];
  //global variable to hold the JSON object with venues from YELP API

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

        /*Extract the relevant data before sending response to front end*/

        var venuesData = [];

        data.businesses.forEach(function(value) {
          //loop through businesses array of objects
          //select only the relevant properties to work with in front-end

          var venueObject = {};

          venueObject.name = value.name;
          venueObject.url = value.url;
          venueObject.snippet_text = value.snippet_text;
          venueObject.image_url = value.image_url;
          venueObject.going = 0;
          venueObject.users = [];

          //check in database if name and url exists
          venuesData.push(venueObject);

        });

        var query = venuesData.map(function(item) {
          //make new array with only the name and url properties to query database with
          return {
            name: item.name,
            url: item.url
          };

        });


        db.collection(VENUES_COLLECTION).find({
          "$or": query
        }).toArray(function(err, doc) {
          //get an array of the venues that exist in the database
          //find returns a cursor and use toArray to convert to array 

          if (err) {

            handleError(res, err.message, "Failed to find venues");

          } else {
            //loop through doc array from database 
            //for every object of doc array loop through venuesObject and check if name and url are the same

            for (var i = 0; i < doc.length; i++) {

              for (var j = 0; j < venuesData.length; j++) {

                if ((venuesData[j].name === doc[i].name) && (venuesData[j].url === doc[i].url)) {
                  //if object from doc array matches object from venuesObject, replace the object with the one in database

                  venuesData[j] = doc[i];

                }


              } //venuesData for loop


            } //doc for loop

            venuesSave = venuesData;

            res.status(200).json(venuesData);
            //send the venuesData object with checked database to frontend as JSON object

          }


        });


      })
      .catch(function(err) {

        console.error(err);

      });

  }); //app.get("/search/:location", function(req, res) 

  app.get("/geo/:lat/:long", function(req, res) {
    //send GET http request to Yelp API with latitude and longitude
    //called from Venues service in Angular JS, getVenuesGeo method

    yelp.search({
        ll: req.params.lat + ',' + req.params.long,
        limit: 20,
        category_filter: 'bars'
      })
      //see https://www.yelp.com/developers/documentation/v2/search_api for the options
      //https://www.yelp.com/developers/documentation/v2/all_category_list for list of all the categories
      .then(function(data) {

        //gets data from Yelp and when ready sends in back to front end

        /*Extract the relevant data before sending response to front end*/

        var venuesData = [];

        data.businesses.forEach(function(value) {
          //loop through businesses array of objects
          //select only the relevant properties to work with in front-end

          var venueObject = {};

          venueObject.name = value.name;
          venueObject.url = value.url;
          venueObject.snippet_text = value.snippet_text;
          venueObject.image_url = value.image_url;
          venueObject.going = 0;
          venueObject.users = [];

          //check in database if name and url exists
          venuesData.push(venueObject);

        });

        var query = venuesData.map(function(item) {
          //make new array with only the name and url properties to query database with
          return {
            name: item.name,
            url: item.url
          };

        });


        db.collection(VENUES_COLLECTION).find({
          "$or": query
        }).toArray(function(err, doc) {
          //get an array of the venues that exist in the database
          //find returns a cursor and use toArray to convert to array 

          if (err) {

            handleError(res, err.message, "Failed to find venues");

          } else {
            //loop through doc array from database 
            //for every object of doc array loop through venuesObject and check if name and url are the same

            for (var i = 0; i < doc.length; i++) {

              for (var j = 0; j < venuesData.length; j++) {

                if ((venuesData[j].name === doc[i].name) && (venuesData[j].url === doc[i].url)) {
                  //if object from doc array matches object from venuesObject, replace the object with the one in database

                  venuesData[j] = doc[i];

                }


              } //venuesData for loop


            } //doc for loop

            venuesSave = venuesData;

            res.status(200).json(venuesData);
            //send the venuesData object with checked database to frontend as JSON object

          }


        });



      })
      .catch(function(err) {

        console.error(err);

      });

  }); //app.get("/search/:location", function(req, res) 

  app.get("/venues/:name", auth, function(req, res) {
    //route for retrieving a venue and manipulate data  

    //console.log(req.params.name);

    //console.log(req.user);

    //console.log(req.user._json);


    db.collection(VENUES_COLLECTION).findOne({
      "name": req.params.name
    }, function(err, doc) {
      //check if venue exists in database with the venue name in URL parameter

      if (err) {
        //handle and show error when db search fails  

        handleError(res, err.message, "Failed to get venue");

      } else {
        //no error, check if venue is matched

        //console.log(doc);

        if (doc == null) {
          //no venue is found
          //add venue to database, set going to 1, add user to array

          console.log(venuesSave);

          var venueDB = {};

          for (var h = 0; h < venuesSave.length; h++) {

            if (venuesSave[h].name === req.params.name) {

              venueDB = venuesSave[h];
              
              venueDB.going = 1;
              
              venueDB.users = [];

              venueDB.users.push(req.user._json);


            }


          }

          db.collection(VENUES_COLLECTION).insertOne(venueDB, function(err, doc) {

            if (err) {

              handleError(res, err.message, "Failed to insert venue");

            } else {

              console.log("venue inserted");
              
              console.log(doc.ops[0]);
              
              //set venueDB with user object to be inserted in DB to empty object again

              res.status(201).json(doc.ops[0]);
              
              venueDB = {};


            }

          });


        } else {
        //a venue is found, edit database
        
          console.log("a venue is found");

          
          //check if user exists with req.user
          //if no + 1 going and add user to array
          //if yes - 1 going and remove user from array

          var found = false;

          var index = 0;

          for (var i = 0; i < doc.users.length; i++) {
            //loop through doc.users array and check if req.user.id can be found

            if (doc.users[i].id == req.user.id) {
              //user is found  

              console.log("we found the user!:" + " " + doc.users[i].name);

              found = true;

              index = i;
              //set i (position where we found the user) to variable index to use later

            }

          } //for loop


          //manipulate doc here, to save later in database

          if (found === true) {
            //user is found: remove the user now  

            doc.going = doc.going - 1;
            //add one to to going property of doc variable

            doc.users.splice(index, 1);
            //remove element at position i from doc.users

          } else {
            //user is not found: add the user  

            console.log("we could not find the user!");

            doc.going = doc.going + 1;
            //remove one from going property of doc variable

            doc.users.push(req.user._json);
            //add element to doc.users

          } //if found is true or not

          console.log(doc);
          
          var editedDoc = doc;

          //replace the venue in the database with doc

          if (doc.users.length === 0) {
            //if users array is empty, remove the venue from the database
            //send the doc to frontend and update the scope with it

            db.collection(VENUES_COLLECTION).deleteOne({
              "name": req.params.name
            }, function(err, doc) {
              //delete venue from database

              if (err) {

                handleError(res, err.message, "Failed to remove venue");

              } else {

                console.log("venue deleted");
                
                 res.status(200).json(editedDoc);


              }

            }); //db.collection(VENUES_COLLECTION).deleteOne


          } else {
            //doc.users.length is not zero  
            //replace the doc venue object with the one in the database  

            db.collection(VENUES_COLLECTION).replaceOne({
              "name": req.params.name
            }, doc, function(err, doc) {

              if (err) {

                handleError(res, err.message, "Failed to replace venue");


              } else {

                res.status(200).json(doc);

                console.log("venue replaced");

              }


            });

          }

        } //if(doc == null) else


      } // if(err) else

    }); //db.collection(VENUES_COLLECTION).findOne

  }); //app.get("/venues/:name"

}); //mongodb.MongoClient.connect