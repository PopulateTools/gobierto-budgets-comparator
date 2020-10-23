$(document).on('turbolinks:load', function () {

  new SlimSelect({
    select: '#municipalities-flyTO',
    placeholder: 'Introduce un municipio'
  })

  var mapMunicipalities = d3.map();
  var dataTOPOJSON = "https://gist.githubusercontent.com/jorgeatgu/dcb73825b02af45250c4dfa66aa0f94f/raw/18a9f2fa108c56454556abc7e08b64eb2a0dc4d8/municipalities_topojson.json";
  var dataMunicipalities = "https://datos.gobierto.es/api/v1/data/data.csv?sql=SELECT+*+FROM+municipios"
  var endPoint = "https://datos.gobierto.es/api/v1/data/data.csv?sql="

  var CHOROPLET_SCALE = [
    [255, 255, 201],
    [192, 229, 174],
    [117, 198, 179],
    [59, 173, 187],
    [30, 134, 181],
    [31, 83, 155],
    [14, 39, 118]
  ]


  var INITIAL_VIEW_STATE = {
    latitude: 40.416775,
    longitude: -3.703790,
    zoom: 5,
    minZoom: 5,
    maxZoom: 8
  };


  var indicatorValue = 'gasto_por_habitante'
  var year = document.getElementsByTagName('body')[0].getAttribute('data-year')
  var queryData = `SELECT+${indicatorValue}+,place_id+FROM+indicadores_presupuestos_municipales+WHERE+year=${year}AND+${indicatorValue}+IS+NOT+NULL`;

  function getValuesIndicators() {
    var populationAndCostQuery = `SELECT+SUM%28population%29+AS+population%2C+SUM%28gasto_total%29+AS+gasto_total+FROM+indicadores_presupuestos_municipales+WHERE+year=${year}`
    var populationAndCostData = `${endPoint}${populationAndCostQuery}`

    d3.csv(populationAndCostData).then(function (data) {
      var totalCost = +data[0].gasto_total
      var totalPopulation = +data[0].population
      var costPerHabitant = (totalCost / totalPopulation)
    })

    var debtQuery = `SELECT+sum%28debt%29+AS+debt+FROM+indicadores_presupuestos_municipales+WHERE+year=${year}`
    var debtData = `${endPoint}${debtQuery}`

    d3.csv(debtData).then(function (data) {
      var totalDebt = +data[0].debt
    })
  }

  var urlData = `${endPoint}${queryData}`

  var indicators = document.querySelectorAll('[data-indicator]')

  indicators.forEach(
    function(indicator) {
     indicator.addEventListener("click", loadIndicators);
    }
  );

  function loadIndicators(e) {
    var year = document.getElementsByTagName('body')[0].getAttribute('data-year')
    var indicatorValue = e.originalTarget.attributes["data-indicator"].nodeValue
    var queryData = `SELECT+${indicatorValue}+,place_id+FROM+indicadores_presupuestos_municipales+WHERE+year=${year}AND+${indicatorValue}+IS+NOT+NULL`;

    var urlData = `${endPoint}${queryData}`

    initMap(urlData, indicatorValue)
  }

  function initMap(queryData, indicator) {
    console.log("queryData", queryData);
    console.log("indicator", indicator);
    d3.csv(queryData).then(function (data) {
      data.forEach(function (d) {
        d.place_id = +d.place_id
        d[indicator] = +d[indicator]
        mapMunicipalities.set(d.place_id, d[indicator]);
      })

      var minValue = d3.min(data, function(d) { return d[indicator]})
      var maxValue = d3.max(data, function(d) { return d[indicator]})

      var textMinValue = document.getElementById('map_legend_min_value')
      var textMaxValue = document.getElementById('map_legend_max_value')
      textMinValue.textContent = minValue
      textMaxValue.textContent = maxValue

      d3.json(dataTOPOJSON).then(function (data) {

        var MUNICIPALITIES = topojson.feature(data, data.objects.municipalities);
        var COLOR_SCALE = d3.scaleThreshold()
          //FIX: HACK DOMAIN
          .domain([minValue, minValue*2, minValue*3, minValue*4, minValue*5, minValue*6, minValue*7])
          .range(CHOROPLET_SCALE);

        var geojsonLayer = new deck.GeoJsonLayer({
          id: 'map',
          data: MUNICIPALITIES,
          stroked: false,
          filled: true,
          opacity: 1,
          getFillColor: function (d) {
            return COLOR_SCALE(d[indicator] = mapMunicipalities.get(d.properties.cp));
          },
          pickable: true
        });

        var deckgl = new deck.Deck({
          canvas: 'map',
          initialViewState: INITIAL_VIEW_STATE,
          controller: true,
          layers: [geojsonLayer],
          getTooltip: function getTooltip(_ref) {
            var object = _ref.object;
            if (object && object[indicator]) {
              return {
                html: "<h3 class=\"tooltip-name\">".concat(object.properties.name, "</h3>\n <span style=\"tooltip-value\">Presupuesto: <b style=\"font-size: .65rem;\">").concat(object[indicator], "\u20AC<b></span>"),
                style: {
                  backgroundColor: '#FFF',
                  fontFamily: 'BlinkMacSystemFont, -apple-system',
                  fontSize: '.65rem',
                  borderRadius: '2px',
                  padding: '0.5rem',
                  boxShadow: '2px 2px 2px 1px rgba(0,0,0,0.1)'
                }
              };
            }
          },
          onViewStateChange: ({viewState}) => deckgl.setProps({viewState})
        });

        d3.csv(dataMunicipalities).then(function(data) {
          var nest = d3
            .nest()
            .key(function(d) { return d.nombre})
            .entries(data);

          nest.sort(function(a, b){
             return d3.ascending(a.key, b.key);
          })

          var selectMunicipalities = d3.select('#municipalities-flyTO');

          selectMunicipalities
            .selectAll('option')
            .data(nest)
            .enter()
            .append('option')
            .attr('value', function(d) { return d.key})
            .text(function(d) { return d.key})

          var increaseButton = document.getElementById('increaseZoom')
          var decreaseButton = document.getElementById('decreaseZoom')

          increaseButton.addEventListener("click", increaseZoom, false)
          decreaseButton.addEventListener("click", decreaseZoom, false)

          function increaseZoom() {
            //In the first render props.viewState are undefined, so we need modify the initialViewState instead viewState
            if (!deckgl.props.hasOwnProperty('viewState')) {
              changeStateProps('initialViewState', true)
            } else {
              changeStateProps('viewState', true)
            }
          }

          function decreaseZoom() {
            if (!deckgl.props.hasOwnProperty('viewState')) {
              changeStateProps('initialViewState', false)
            } else {
              changeStateProps('viewState', false)
            }
          }

          function changeStateProps(value, increase) {
            var increaseDecrease = increase === true ? + 1 : - 1
            deckgl.setProps({
              viewState: {
                zoom: deckgl.props[value].zoom + increaseDecrease,
                latitude: deckgl.props[value].latitude,
                longitude: deckgl.props[value].longitude,
                maxZoom: deckgl.props[value].maxZoom,
                minZoom: deckgl.props[value].minZoom
              }
            })
          }

          selectMunicipalities.on('change', function() {
            //Get the selected municipality
            var value = d3
              .select(this)
              .property('value')

            //Filter municipalities with the selected value
            var selectElement = data.filter(function (el) {
              return el.nombre === value
            });

            //Pass coordinates to deck.gl
            deckgl.setProps({
              viewState: {
                longitude: +selectElement[0].lat,
                latitude: +selectElement[0].lon,
                zoom: 9,
                transitionInterpolator: new deck.FlyToInterpolator(),
                transitionDuration: 1500
              }
            })

            //Clone MUNICIPALITIES object
            var strokeDATA = JSON.parse(JSON.stringify(MUNICIPALITIES));

            var strokeDATAFILTER = strokeDATA.features

            //Filter by selected municipality
            var strokeSelected = strokeDATAFILTER.filter(function (el) {
              return el.properties.name === value
            });

            //Replace object features
            strokeDATA.features = strokeSelected

            //Create a new layer that contains only the selected municipality
            var selectedMunicipality = [new deck.GeoJsonLayer({
              id: 'map',
              data: strokeDATA,
              stroked: true,
              filled: true,
              lineWidthMinPixels: 1,
              opacity: 1,
              getFillColor: function (d) {
                return COLOR_SCALE(d.budget = mapMunicipalities.get(d.properties.cp));
              },
              pickable: true
            })];

            //Update deck.gl with the old and new layer.
            deckgl.setProps({layers: [geojsonLayer, selectedMunicipality]});
          });
        });
      });
    })

  }
  initMap(urlData, indicatorValue)
  getValuesIndicators()
});

/* function placesScopeCondition(){
   if(window.placesScope.length)
     return " i.place_id IN (" + window.placesScope + ")";
   else
     return " 1=1";
 }
  function filterOutliers(someArray) {
   // Copy the values, rather than operating on references to existing values
   var values = someArray.slice(0);
    // Then sort
   values.sort( function(a, b) {
           return a - b;
        });
    /* Then find a generous IQR. This is generous because if (values.length / 4)
    * is not an int, then really you should average the two elements on either
    * side to find q1.
    */

/*var q1 = values[Math.floor((values.length / 4))];
// Likewise for q3.
var q3 = values[Math.ceil((values.length * (3 / 4)))];
var iqr = q3 - q1;
 // Then find min and max values
var maxValue = q3 + iqr*1.5;
var minValue = q1 - iqr*1.5;
 // Then filter anything beyond or beneath these values.
var filteredValues = values.filter(function(x) {
    return (x < maxValue) && (x > minValue);
});
 // Then return
return filteredValues;
}*/

/*function renderMapIndicator(layer, vis){
  $('[data-indicator]').click(function(e){
    $('#map .overlay').css({
      'display': 'block'
    });
     $('#map .cartodb-tiles-loader').css({
      'position': 'relative',
      'z-index': '-1'
    });
     $('.cartodb-tooltip').hide();
    var year = $('body').data('year');
    var indicator = $('.metric.selected').data('indicator');
    layer.show();
     var sql = new cartodb.SQL({ user: 'gobierto' });
    if(indicator === 'debt'){
      year--;
    }
    sql.execute("SELECT {{indicator}} as value FROM indicators_{{year}} as i WHERE" + placesScopeCondition(), { indicator: indicator, year: year })
      .done(function(data) {
        var customColors = colors.slice(0);
         // push all the values into an array
        var values = [];
        data.rows.forEach(function(row,i) {
          values.push(row['value']);
        });
        values = filterOutliers(values);
         var clusters = ss.ckmeans(values, customColors.length);
        var ranges = clusters.map(function(cluster){
          return [cluster[0],cluster.pop()];
        });
         var css = "#indicators_2017 [ value = 0]  { polygon-fill: #ffffff; } ";
        if(indicator === 'debt'){
          css = "#indicators_2017 [ value = 0]  { polygon-fill: "+customColors[0]+"; } ";
        }
        ranges.forEach(function(range,i){
          var value = range[0];
          if(i === 0)
            value = 0;
          var color = customColors[i];
          css += "#indicators_2017 [value>"+value + "] {polygon-fill:" + color + "}\n";
        });
         var query = "select i.cartodb_id, t.place_id as place_id, t.nameunit as name, t.the_geom, " +
                    "t.the_geom_webmercator, i."+indicator+" as value, TO_CHAR(i."+indicator+", '999G999G990') as valuef, " +
                    "'"+indicators[indicator].name+"' as indicator_name, '"+indicators[indicator].unit+"' as unit" +
                    " from ign_spanish_adm3_municipalities_displaced_canary as t full join indicators_"+year+" as i " +
                    " on i.place_id = t.place_id WHERE" + placesScopeCondition();
        layer.setSQL(query);
         layer.setCartoCSS(css);
        layer.show();
         var lc = $('#legend-container');
        lc.html($('#legend').html());
        lc.find('.min').html('< ' + accounting.formatNumber(ranges[0][1], 0) + ' ' + indicators[indicator].unit);
        lc.find('.max').html('> ' + accounting.formatNumber(ranges[ranges.length-1][0], 0) + ' ' + indicators[indicator].unit);
        customColors.forEach(function(color){
          var c = $('<div class="quartile" style="background-color:'+color+'"></div>');
          lc.find('.colors').append(c);
        });
      })
    .error(function(errors) {
      console.log("errors:" + errors);
    });
  });
}*/

/* function renderMapBudgetLine(layer, vis){
   $(document).on('renderBudgetLineCategory', function(e){
     $('.cartodb-tooltip').hide();
     $('#map .overlay').css({
       'display': 'block'
     });
      $('#map .cartodb-tiles-loader').css({
       'position': 'relative',
       'z-index': '-1'
     });
      $('.cartodb-tooltip').hide();
     $('.metric').removeClass('selected');
     var year = $('body').data('year');
      layer.show();
      var sql = new cartodb.SQL({ user: 'gobierto' });
     sql.execute("SELECT i.amount_per_inhabitant as value FROM planned_budgets_{{year}} as i WHERE code='"+e.code+"' AND kind='" + e.kind + "' AND area='" + e.area[0] + "' AND" + placesScopeCondition(), { year: year })
       .done(function(data) {
         // push all the values into an array
         var values = [];
         data.rows.forEach(function(row,i) {
           values.push(row['value']);
         });
         values = filterOutliers(values);
          var clusters = ss.ckmeans(values, colors.length);
         var ranges = clusters.map(function(cluster){
           return [cluster[0],cluster.pop()];
         });
          var css = "#indicators_2017 [ value = 0]  { polygon-fill: #ffffff; } ";
         ranges.forEach(function(range,i){
           var value = range[0]
           var color = colors[i];
           css += "#indicators_2017 [value>"+value + "] {polygon-fill:" + color + "}\n";
         });
          var query = "select i.cartodb_id, t.place_id as place_id, t.nameunit as name, t.the_geom, t.the_geom_webmercator, " +
           " i.code, i.kind, i.area, i.amount, i.amount_per_inhabitant as value," +
           " TO_CHAR(i.amount_per_inhabitant, '999G999G990') as valuef, " +
           " '"+indicators['gasto_por_habitante'].name+"' as indicator_name, '"+indicators['gasto_por_habitante'].unit+"' as unit" +
           " from ign_spanish_adm3_municipalities_displaced_canary as t full join planned_budgets_"+year+" as i on i.place_id = t.place_id" +
           " WHERE code='"+e.code+"' AND kind='" + e.kind + "' AND area='" + e.area[0] + "' AND" + placesScopeCondition();
          layer.setSQL(query);
          layer.setCartoCSS(css);
         layer.show();
          var lc = $('#legend-container');
         lc.html($('#legend').html());
         lc.find('.min').html('< ' + accounting.formatNumber(ranges[0][1], 0) + ' ' + indicators['gasto_por_habitante'].unit);
         lc.find('.max').html('> ' + accounting.formatNumber(ranges[ranges.length-1][0], 0) + ' ' + indicators['gasto_por_habitante'].unit);
         colors.forEach(function(color){
           var c = $('<div class="quartile" style="background-color:'+color+'"></div>');
           lc.find('.colors').append(c);
         });
       })
       .error(function(errors) {
         console.log("errors:" + errors);
       });
      $('#legend-container').html($('#legend').html());
   });
 }*/

/*if($('#map').length){
   var colors = ['#ffffcc','#c7e9b4','#7fcdbb','#41b6c4','#1d91c0','#225ea8','#0c2c84'];
  var indicators = {
    gasto_por_habitante: {
      name: I18n.t('gobierto_budgets.pages.map.expense_per_inhabitant'),
      unit: '€/hab',
    },
    gasto_total: {
      name: I18n.t('gobierto_budgets.pages.map.expense'),
      unit: '€',
    },
    planned_vs_executed: {
      name: I18n.t('gobierto_budgets.pages.map.planned_vs_executed'),
      unit: '%',
    },
    debt: {
      name: I18n.t('gobierto_budgets.pages.map.debt'),
      unit: '€',
    },
    population: {
      name: I18n.t('gobierto_budgets.pages.map.population'),
      unit: ' ' + I18n.t('gobierto_budgets.pages.map.people'),
    }
  };
   cartodb.createVis('map', 'https://gobierto.carto.com/api/v2/viz/205616b2-b893-11e6-b070-0e233c30368f/viz.json', {
    shareable: false,
    title: false,
    description: false,
    search: false,
    tiles_loader: true,
    center_lat: window.mapSettings.centerLat,
    center_lon: window.mapSettings.centerLon,
    zoom: window.mapSettings.zoomLevel,
    zoomControl: true,
    loaderControl: true
  })
  .done(function(vis, layers) {
    var sublayer = layers[1].getSubLayer(0);
    vis.addOverlay({
      type: 'tooltip',
      layer: sublayer,
      template: $('#infowindow_template').html(),
      position: 'bottom|right',
      fields: [{ name: 'name', value: 'value', valuef: 'valuef', indicator_name: 'indicator_name', unit: 'unit', place_id: 'place_id' }]
    });
    sublayer.setInteractivity('name, value,valuef,indicator_name,unit,place_id');
    renderMapIndicator(sublayer, vis);
    renderMapBudgetLine(sublayer, vis);
    $('[data-indicator].selected').click();
     // On load, hide the overlay and reset the tile spinner
    layers[1].on("load", function() {
      $('#map .overlay').css({
        'display': 'none'
      });
       $('#map .cartodb-tiles-loader').css({
        'position': 'initial',
        'z-index': '0'
      });
    });
     var year = $('body').data('year');
    sublayer.on('featureClick', function(e, latlng, pos, data, subLayerIndex) {
      window.location.href = "/places/" + data.place_id + "/" + year + "/redirect";
    });
     // If there is a placesScop, remove Spain attribution
    if(window.placesScope.length > 0 && $('.leaflet-control-attribution').length){
      var str = $('.leaflet-control-attribution').html().replace(", © IGN España", "");
      $('.leaflet-control-attribution').html(str);
    }
  })
  .error(function(err) {
    console.log(err);
  });
   $('.metric').on('click', function(e){
    e.preventDefault();
    $('.metric').removeClass('selected');
    $('[data-category-code]').removeClass('active');
    $(this).addClass('selected');
  });
}*/
