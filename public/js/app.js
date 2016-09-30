/*global angular*/
/*global navigator*/

angular.module("popperooApp", ['ngRoute', 'ngCookies'])
//create ANgular app and inject ngRoute dependency
    .config(function($routeProvider){
       $routeProvider
        .when("/", {
        //configure root route with routeProvider    
            templateUrl: "list.html",
            controller: "ListController"
        })
        .when("/reload/", {
         
            templateUrl: "list.html",
            controller: "ReloadController"
            
        })
        .otherwise({
           
           redirectTo: "/" 
            
        });
    })
    .service("Venues", function($http){
    //Service that interacts with Express RESTful API
    //injects native $http for communication with remote server
    
    /*Pre-load current location*/
        var lat = "";
        
        var long = "";
        
        var geoURL = "";
        //save current location in geoURL variable used in all Venues service methods
        
            if(navigator.geolocation){
                
                navigator.geolocation.getCurrentPosition(setPosition);
       
            }  
            
            function setPosition(position){
                
                lat  = position.coords.latitude.toString();
                long = position.coords.longitude.toString();

                
                geoURL = "geo/" + lat + "/" + long;
                
            }
    
    
        this.getVenues = function(location){
        //service for gettting all the venues based on a location search
        //use location input from form as url parameter to call RESTful API
        //GET /search/:location
           
          var url = "search/" + location; 
            
          return $http.get(url);  
            
        };
        
        this.getVenuesGeo = function(){
            
            return $http.get(geoURL);
            //call RESTful API with current location
            
        };
        
        this.checkGoing = function(name){
        //method to check and manipulate if any users are going, who are going and how many 
            
            var checkURL = "venues/" + name;
            
            return $http.get(checkURL);
            
        };
        

    })
    .controller('ListController', function($scope, Venues, $cookieStore){
    //controller to show all venues
    //inject $scope
    //controller is loaded and refreshed when page refreshes (happens after Passport JS login)
    
    var hasSearched = $cookieStore.get('hasSearched');
    //retrieve from cookie if the user has searched yet or not
    
    var hasSearchedGeo = $cookieStore.get('hasSearchedGeo');
    //retrieve from cookie if the user has searched on GeoLocation yet or not
    
    var locationQuery = $cookieStore.get('locationQuery');
    //retrieve from cookie the previous location query
    
    if(hasSearched == true){
    //if the user has searched before, use the query to automatically search again and set the scope
        
        Venues.getVenues(locationQuery)
                .then(function(response){
                    
                    $scope.venues = response.data;
                    //bind data to the $scope as venues property
                    
                }, function(response){
                    
                   alert("Error retrieving venues"); 
                   
                   console.log(response);
                    
                });
                
                $cookieStore.remove('hasSearched');
            
    }
    
    if(hasSearchedGeo == true){
        
        Venues.getVenuesGeo()
            .then(function(response){
              
                $scope.venues = response.data;
  
            }, function(response){
                
                alert("Error retrieving venues with your location");
                
            });
            
        $cookieStore.remove('hasSearchedGeo');    
        
    }
    
    
        $scope.searchLocation = function(location) {
        //attach a searchLocation method to the scope, called in form with ng-click="searchLocation(mylocation)"
        //call getVenues depending on location entered or empty
            
        //controller is re-loaded on every page reload. Happens after passport login. $scope.venues is then lost 
        
            $cookieStore.put('hasSearched', true);
            //set cookie to store that user has searched before
            
            $cookieStore.put('locationQuery', location);
            //set cookie to store the location query
            
            Venues.getVenues(location)
                .then(function(response){
                    
                    $scope.venues = response.data;
                    //bind data to the $scope as venues property
                    
                }, function(response){
                    
                   alert("Error retrieving venues"); 
                   
                   console.log(response);
                    
                });
            
        };
        
        $scope.geoLocation = function(){
        //get YELP API data with current location  
        
        $cookieStore.put('hasSearchedGeo', true);
            
          Venues.getVenuesGeo()
            .then(function(response){
              
                $scope.venues = response.data;
  
            }, function(response){
                
                alert("Error retrieving venues with your location");
                
            });
            
            
        };
        
        
        $scope.findGoing = function(name) {
          
          Venues.checkGoing(name)
          //get the name and URL from the venue clicked
           .then(function(response){
               
               for(var i=0; i < $scope.venues.length; i++){
               //find the venue in $scope.venues that matches the venue object from back end       
                   
                   if($scope.venues[i].name == response.data.name){
                       
                       $scope.venues[i] = response.data;
                       
                   }
                   
               }
               
           }, function(response){
               
               console.log("Error finding venue");
               
           });   
        
        };
        
        
    }).controller('ReloadController', function($scope,Venues){
        
        
            /*Venues.getVenues($routeParams.query)
                .then(function(response){
                    
                    $scope.venues = response.data;
                    //bind data to the $scope as venues property
                    
                }, function(response){
                    
                   alert("Error retrieving venues"); 
                   
                   console.log(response);
                    
                });*/
       
        
    })
    .service('authInterceptor', function($q) {
    //service to intercept a 401 response from Express REST API if user is not authenticated for a protected endPoint  
        
        var service = this;
    
        service.responseError = function(response) {
        //make a authIntercepter.responseError() method that takes a server response   
            
            if (response.status == 401){
            //if response error status is 401 redirect to login URL 
                
                 window.location = "/auth/facebook";
                
            }
            //if the response error status is something other than 401 reject the promise with the response
            
            return $q.reject(response);
            
        };
    
    })
    .config(['$httpProvider', function($httpProvider) {
    //add authInterceptor service to httpProvider so its used in    
        
        $httpProvider.interceptors.push('authInterceptor');
        
    }]);
    
    
    