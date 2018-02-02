angular.module('muniApp', [])

  .controller('MuniController', ['$scope', '$http', '$window', 'MuniModel',
    function($scope, $http, $window, MuniModel) {

    var width = 700;
    var height = 600;
    var neighborhoods = 'sfmaps/neighborhoods.json';
    var arteries = 'sfmaps/arteries.json';
    var freeways = 'sfmaps/freeways.json';
    var streets = 'sfmaps/streets.json';
    var tip = d3.tip()
      .attr('class', 'd3-tip')
      .html(function(d) { return d; });
    var svg = d3.select('#map')
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    svg.call(tip);
    // Create groups for different road types
    var neighborhoodsGroup = svg.append('g');
    var arteriesGroup = svg.append('g');
    var streetsGroup = svg.append('g');
    var freewaysGroup = svg.append('g');
    // Create projection
    var projection = d3.geoConicConformal();
    // Create path
    var path = d3.geoPath()
      .projection(projection);
    // Set color scale
    var colorScale = d3.scaleSequential(d3["interpolateRainbow"])
        .domain([0, 1]);

    var getBusColorsByRoute = function(routeList) {
      var colorRouteMapping = {};
      var routeTag;
      var colorByIdx;
      if (routeList) {
        routeList.forEach(function(route, idx) {
          routeTag = route.tag;
          colorByIdx = idx * .01;
          colorRouteMapping[routeTag] = colorRouteMapping[routeTag] ?
            colorRouteMapping[routeTag] : colorScale(colorByIdx);
        });
      }
      return colorRouteMapping;
    };
    // Define data functions             
    var getRouteList = MuniModel.getRouteList;
    var getBusLocations = MuniModel.getBusLocations;

    // Neighborhoods
    d3.json(neighborhoods, function(err, neighborhoodsData) {
      if (err) {
        console.error(err);
      }
      projection
        .parallels([33, 45])
        .rotate([96, 33])
        .fitSize([width, height], neighborhoodsData);

      neighborhoodsGroup.append('path')
        .datum(neighborhoodsData)
        .attr('class', 'neighborhood')
        .attr('d', path);

      // Arteries
      d3.json(arteries, function(err, arteriesData) {
        if (err) {
          console.error(err);
        }
        arteriesGroup.selectAll("path")
          .data(arteriesData.features)
          .enter()
          .append("path")
          .attr("d", path)
          .attr('class', 'arteries');
      });

      // Freeways
      d3.json(freeways, function(err, freewaysData) {
        if (err) {
          console.error(err);
        }
        freewaysGroup.selectAll("path")
          .data(freewaysData.features)
          .enter()
          .append("path")
          .attr("d", path)
          .attr('class', 'freeways');
      });

      // Streets
      d3.json(streets, function(err, streetsData) {
        if (err) {
          console.error(err);
        }
        streetsGroup.selectAll("path")
          .data(streetsData.features)
          .enter()
          .append("path")
          .attr("d", path)
          .attr('class', 'streets');
      });

      $scope.busLocations;

      var refreshBusLocations = function(routeList) {
        $window.async.map(routeList, getBusLocations,
          function(err, busLocations) {
            if (err) {
              throw new Error('Error', err);
              return;
            }
            $window.async.each(busLocations, function(busLine, eachCallback) {
              if (busLine && busLine.data && busLine.data.vehicle) {
                if (!Array.isArray(busLine.data.vehicle)) {
                  busLine.data.vehicle = [busLine.data.vehicle];
                }
                var t = d3.transition()
                  .duration(5000);
                var busLineTag = busLine.data.vehicle[0].routeTag;

                if (busLineTag) {
                  var busLineGroupId = 'bus-line-' + busLineTag;
                  var busLineGroup = svg.select('g#' + busLineGroupId);
                  // Create matrix of coordinates for each bus in the busLine
                  var vehicleData = busLine.data.vehicle
                    .map(function(v) {
                      return { coordinates: [+v.lon, +v.lat], key: v.id };
                    });
                  // Create a new group only if it does not currently exist on DOM
                  if (busLineGroup.empty()) {
                    busLineGroup = svg.append('g')
                      .attr('id', busLineGroupId)
                      .attr('display', function() {
                        if ($scope.data.selectedRoutes.length > 0 &&
                            $scope.data.selectedRoutes.indexOf(busLineTag) < 0)
                          return 'none';
                        else
                          return 'inline';
                      });
                  }
                  // JOIN new data with old elements.
                  var circles = busLineGroup.selectAll("circle")
                    .data(vehicleData, function(d) { return d.key; });
                  // EXIT old elements not present in new data.
                  circles.exit()
                    .remove();
                  // UPDATE old elements present in new data.
                  circles
                    .transition(t)
                      .attr("transform", function(v) {
                        return "translate(" + projection(v.coordinates) + ")";
                      });
                  if ($scope.data.busColorsByRoute[busLineTag]) {
                    // ENTER new elements present in new data.
                    circles.enter()
                      .append("circle")
                      .attr("r", "5px")
                      .attr('class', busLineTag)
                      .attr("fill", function(v) {
                        return $scope.data.busColorsByRoute[busLineTag];
                      })
                      .attr("transform", function(v) {
                        return "translate(" + projection(v.coordinates) + ")";
                      })
                      .on('mouseover', function(d, i) {
                        tip.show(busLineTag)
                      })
                      .on('mouseout', function(d, i) {
                        tip.hide(busLineTag)
                      });
                  }
                }
              } else {
                console.error('Required data unavailable for route.');
              }
              eachCallback();
            }, function(err) {
              if (err) {
                console.error(err);
              } else {
                console.log('Updated bus locations by route.');
              }
              setTimeout(function() {
                refreshBusLocations(routeList)
              }, 10000);
            });
        });
      };

      $window.async.parallel({
        routeList: function(callback) {
          getRouteList(callback);
        }
      }, function(err, results) {
        if (err) {
          throw new Error('Err:', err);
        }
        // Set scope variables
        $scope.data = {
          selectedRoutes: [],
          busColorsByRoute: null,
          filteredColorRouteMapping: function() {
            var result = {};
            if ($scope.data.selectedRoutes.length > 0) {
              for (var key in $scope.data.busColorsByRoute) {
                if ($scope.data.selectedRoutes.indexOf(key) > -1) {
                  result[key] = $scope.data.busColorsByRoute[key];
                }
              }
            }
            return result;
          },
          isRouteSelected: function(route) {
            var idx = $scope.data.selectedRoutes.indexOf(route);
            return idx > -1;
          }
        };

        $scope.ui = {
          filterBusesByRoute: function(route) {
            var idx = $scope.data.selectedRoutes.indexOf(route);
            if (idx < 0) {
              $scope.data.selectedRoutes.push(route);
            } else {
              $scope.data.selectedRoutes.splice(idx, 1);
            }
            var groups = svg.selectAll('g')
              .each(function(d, i) {
                var group = d3.select(this);
                var tag = group.attr("id") ? group.attr("id") : null;
                tag = tag ? tag.split('-')[2] : null;
                if (tag && $scope.data.selectedRoutes.length &&
                    $scope.data.selectedRoutes.indexOf(tag) < 0) {
                  group.attr('display', 'none')
                } else {
                  group.attr('display', 'inline')
                }
              });
          }
        };

        var routeList = results.routeList;
        $scope.data.busColorsByRoute = getBusColorsByRoute(routeList);
        refreshBusLocations(routeList);
        setTimeout(function() {
          refreshBusLocations(routeList)
        }, 10000)
      });
    });


  }])



