/*global angular*/

angular.module("popperooApp", ['ngRoute'])
//create ANgular app and inject ngRoute dependency
    .config(function($routeProvider){
       $routeProvider
        .when("/", {
        //configure root route with routeProvider    
            templateUrl: "list.html",
            controller: "ListController"
        })
        .otherwise({
           
           redirectTo: "/" 
            
        });
    })
    .service("Venues", function($http){
    //Service that interacts with Express RESTful API
    //injects native $http for communication with remote server
        
        this.getVenues = function(location){
        //service for gettting all the venues based on a location search
        //use location input from form as url parameter to call RESTful API
        //GET /search/:location
           
          var url = "search/" + location;    
            
          return $http.get(url);  
            
        };

    })
    .controller('ListController', function($scope, Venues){
    //controller to show all venues
    //inject $scope
    
        $scope.searchLocation = function(location) {
        //attach a searchLocation method to the scope, called in form with ng-click="searchLocation(mylocation)"
            Venues.getVenues(location)
                .then(function(response){
                    
                    $scope.venues = response.data;
                    //bind data to the $scope as venues property
                    
                }, function(response){
                    
                   alert("Error retrieving venues"); 
                   
                   console.log(response);
                    
                });
            
        };
    });

