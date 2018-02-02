angular
  .module('muniApp')
  .factory('MuniModel', ['$http', function($http) {

      var getRouteList = function(callback) {
        var url = 'http://webservices.nextbus.com/service/publicJSONFeed?' +
          'command=routeList&a=sf-muni';
        $http({
          method: 'GET',
          url: url
        }).then(function(response) {
          callback(null, response.data.route);
        });
      };

      var getBusLocations = function(route, callback) {
        var time = 0;
        var routeTag = route.tag;
        var url = 'http://webservices.nextbus.com/service/publicJSONFeed?' +
          'command=vehicleLocations&a=sf-muni&r=' + routeTag + '&t=' + time
        $http({
          method: 'GET',
          url: url
        }).then(function(response) {
          callback(null, response);
        });
      };

      return {
        getRouteList: getRouteList,
        getBusLocations: getBusLocations
      };
}]);