(function(exports){
var cubism = exports.cubism = {version: "1.6.0"};
var cubism_id = 0;
function cubism_identity(d) { return d; }
cubism.option = function(name, defaultValue) {
  var values = cubism.options(name);
  return values.length ? values[0] : defaultValue;
};

cubism.options = function(name, defaultValues) {
  var options = location.search.substring(1).split("&"),
      values = [],
      i = -1,
      n = options.length,
      o;
  while (++i < n) {
    if ((o = options[i].split("="))[0] == name) {
      values.push(decodeURIComponent(o[1]));
    }
  }
  return values.length || arguments.length < 2 ? values : defaultValues;
};
cubism.context = function(options) {
  var context = new cubism_context,
      step = options && options.step ? options.step : 1e4, // ten seconds, in milliseconds
      size = options && options.size ? options.size : 1440, // four hours at ten seconds, in pixels
      shift = 0, // no shift by default
      start0, stop0, // the start and stop for the previous change event
      start1, stop1, // the start and stop for the next prepare event
      serverDelay = options && options.serverDelay ? options.serverDelay : 5e3,
      clientDelay = options && options.clientDelay ? options.clientDelay : 5e3,
      event = d3.dispatch("prepare", "beforechange", "change", "focus"),
      scale = context.scale = d3.time.scale().range([0, size]),
      timeout,
      clientTimeout,
      focusAnchor = null,
      focus,
      drawAsync = options && typeof options.drawAsync !== 'undefined' ? options.drawAsync : true,
      requestCounter = 0,
      pixelWidth = options && options.pixelWidth ? options.pixelWidth : 1,
      isFetchFailing = false;
      
      

  function update() {
    var now = Date.now();
    stop0 = stop1 = new Date(Math.floor((now - serverDelay - clientDelay + shift) / step) * step);
    start0 = start1 = new Date(stop0 - (size / pixelWidth | 0) * step);
    scale.domain([start0, stop0]);
    return context;
  }

  context.start = function() {
    if (timeout) clearTimeout(timeout);
    if (clientTimeout) clearTimeout(clientTimeout);
    var delay = +stop1 + serverDelay - Date.now() - shift;

    // If we're too late for the first prepare event, skip it.
    if (delay <= clientDelay) delay = (+stop1 + step - Date.now()) + serverDelay;
    
    timeout = setTimeout(function prepare() {
      stop1 = new Date(Math.floor((Date.now() - serverDelay + shift) / step) * step);
      start1 = new Date(stop1 - (size / context.pixelWidth() | 0) * step);
      event.prepare.call(context, start1, stop1);

      clientTimeout = setTimeout(function emitChange() {
        if(!drawAsync) {
            if(isFetchFailing)
            return;  
          
            if(requestCounter) {
                clientTimeout = setTimeout(emitChange, clientDelay);
                return;
            }
        }
            
        scale.domain([start0 = start1, stop0 = stop1]);
        event.beforechange.call(context, start1, stop1);
        event.change.call(context, start1, stop1);
        event.focus.call(context, focus);
      }, clientDelay);

      timeout = setTimeout(prepare, step);
    }, delay);
    return context;
  };

  context.stop = function() {
    timeout = clearTimeout(timeout);
    clientTimeout = clearTimeout(clientTimeout);
    return context;
  };

  timeout = setTimeout(context.start, 10);

  // Set or get the step interval in milliseconds.
  // Defaults to ten seconds.
  context.step = function(_) {
    if (!arguments.length) return step;
    step = +_;
    return update();
  };

  // Set or get the context size (the count of metric values).
  // Defaults to 1440 (four hours at ten seconds).
  context.size = function(_) {
    if (!arguments.length) return size;
    scale.range([0, size = +_]);
    return update();
  };

  // Set or get the metric shift (the count of metric values).
  // Defaults to 0.
  context.shift = function(_) {
    if (!arguments.length) return shift;
    shift = +_;
    return update();
  };
   
  context.focusAnchor = function(_) {
      if (!arguments.length) return focusAnchor;
      focusAnchor = _;
      return context;
  };

  // The server delay is the amount of time we wait for the server to compute a
  // metric. This delay may result from clock skew or from delays collecting
  // metrics from various hosts. Defaults to 4 seconds.
  context.serverDelay = function(_) {
    if (!arguments.length) return serverDelay;
    serverDelay = +_;
    return update();
  };

  // The client delay is the amount of additional time we wait to fetch those
  // metrics from the server. The client and server delay combined represent the
  // age of the most recent displayed metric. Defaults to 1 second.
  context.clientDelay = function(_) {
    if (!arguments.length) return clientDelay;
    clientDelay = +_;
    return update();
  };
  
  context.drawAsync = function(_) {
      if (!arguments.length) return drawAsync;
      drawAsync = _;
      return context;
  };
  
  
  
  context.requestCounter = function(_) {
    if (!arguments.length) return requestCounter;
    requestCounter = +_;
    requestCounter = Math.max(0, requestCounter);
    return context;
  };
  
  context.isFetchFailing =  function(_) {
    if (!arguments.length) return isFetchFailing;
    isFetchFailing = _;
    return context;
  };
  
  context.pixelWidth = function(_) {
    if(!arguments.length) return pixelWidth;
    pixelWidth = +_;
    return context;
  };

  // Sets the focus to the specified index, and dispatches a "focus" event.
  context.focus = function(i) {
    i = i === null ? focusAnchor : i;
    event.focus.call(context, focus = i);
    return context;
  };

  // Add, remove or get listeners for events.
  context.on = function(type, listener) {
    if (arguments.length < 2) return event.on(type);

    event.on(type, listener);

    // Notify the listener of the current start and stop time, as appropriate.
    // This way, metrics can make requests for data immediately,
    // and likewise the axis can display itself synchronously.
    if (listener != null) {
      if (/^prepare(\.|$)/.test(type)) listener.call(context, start1, stop1);
      if (/^beforechange(\.|$)/.test(type)) listener.call(context, start0, stop0);
      if (/^change(\.|$)/.test(type)) listener.call(context, start0, stop0);
      if (/^focus(\.|$)/.test(type)) listener.call(context, focus);
    }

    return context;
  };

  d3.select(window).on("keydown.context-" + ++cubism_id, function() {
    if(d3.event.target.nodeName.toLowerCase() == 'input')
        return;
    
    switch (!d3.event.metaKey && d3.event.keyCode) {
      case 37: // left
        if (focus == null) focus = size - 1;
        if (focus > 0) context.focus(focus -= pixelWidth);
        break;
      case 39: // right
        if (focus == null) focus = size - 2;
        if (focus < size - 1) context.focus(focus += pixelWidth);
        break;
      default: return;
    }
    d3.event.preventDefault();
  });

  return update();
};

function cubism_context() {}

var cubism_contextPrototype = cubism.context.prototype = cubism_context.prototype;

cubism_contextPrototype.constant = function(value) {
  return new cubism_metricConstant(this, +value);
};
cubism_contextPrototype.cube = function(host) {
  if (!arguments.length) host = "";
  var source = {},
      context = this;

  source.metric = function(expression) {
    return context.metric(function(start, stop, step, callback) {
      d3.json(host + "/1.0/metric"
          + "?expression=" + encodeURIComponent(expression)
          + "&start=" + cubism_cubeFormatDate(start)
          + "&stop=" + cubism_cubeFormatDate(stop)
          + "&step=" + step, function(data) {
        if (!data) return callback(new Error("unable to load data"));
        callback(null, data.map(function(d) { return d.value; }));
      });
    }, expression += "");
  };

  // Returns the Cube host.
  source.toString = function() {
    return host;
  };

  return source;
};

var cubism_cubeFormatDate = d3.time.format.iso;
/* librato (http://dev.librato.com/v1/post/metrics) source
 * If you want to see an example of how to use this source, check: https://gist.github.com/drio/5792680
 */
cubism_contextPrototype.librato = function(user, token) {
  var source      = {},
      context     = this;
      auth_string = "Basic " + btoa(user + ":" + token);
      avail_rsts  = [ 1, 60, 900, 3600 ];

  /* Given a step, find the best librato resolution to use.
   *
   * Example:
   *
   * (s) : cubism step
   *
   * avail_rsts   1 --------------- 60 --------------- 900 ---------------- 3600
   *                                |    (s)            |
   *                                |                   |
   *                              [low_res             top_res]
   *
   * return: low_res (60)
   */
  function find_ideal_librato_resolution(step) {
    var highest_res = avail_rsts[0],
        lowest_res  = avail_rsts[avail_rsts.length]; // high and lowest available resolution from librato

    /* If step is outside the highest or lowest librato resolution, pick them and we are done */
    if (step >= lowest_res)
      return lowest_res;

    if (step <= highest_res)
      return highest_res;

    /* If not, find in what resolution interval the step lands. */
    var iof, top_res, i;
    for (i=step; i<=lowest_res; i++) {
      iof = avail_rsts.indexOf(i);
      if (iof > -1) {
        top_res = avail_rsts[iof];
        break;
      }
    }

    var low_res;
    for (i=step; i>=highest_res; i--) {
      iof = avail_rsts.indexOf(i);
      if (iof > -1) {
        low_res = avail_rsts[iof];
        break;
      }
    }

    /* What's the closest librato resolution given the step ? */
    return ((top_res-step) < (step-low_res)) ? top_res : low_res;
  }

  function find_librato_resolution(sdate, edate, step) {
    var i_size      = edate - sdate,                 // interval size
        month       = 2419200,
        week        = 604800,
        two_days    = 172800,
        ideal_res;

    if (i_size > month)
      return 3600;

    ideal_res = find_ideal_librato_resolution(step);

    /*
     * Now we have the ideal resolution, but due to the retention policies at librato, maybe we have
     * to use a higher resolution.
     * http://support.metrics.librato.com/knowledgebase/articles/66838-understanding-metrics-roll-ups-retention-and-grap
     */
    if (i_size > week && ideal_res < 900)
      return 900;
    else if (i_size > two_days && ideal_res < 60)
      return 60;
    else
      return ideal_res;
  }

  /* All the logic to query the librato API is here */
  var librato_request = function(composite) {
    var url_prefix  = "https://metrics-api.librato.com/v1/metrics";

    function make_url(sdate, edate, step) {
      var params    = "compose="     + composite +
                      "&start_time=" + sdate     +
                      "&end_time="   + edate     +
                      "&resolution=" + find_librato_resolution(sdate, edate, step);
      return url_prefix + "?" + params;
    }

    /*
     * We are most likely not going to get the same number of measurements
     * cubism expects for a particular context: We have to perform down/up
     * sampling
     */
    function down_up_sampling(isdate, iedate, step, librato_mm) {
      var av = [];

      for (i=isdate; i<=iedate; i+=step) {
        var int_mes = [];
        while (librato_mm.length && librato_mm[0].measure_time <= i) {
          int_mes.push(librato_mm.shift().value);
        }

        var v;
        if (int_mes.length) { /* Compute the average */
          v = int_mes.reduce(function(a, b) { return a + b }) / int_mes.length;
        } else { /* No librato values on interval */
          v = (av.length) ? av[av.length-1] : 0;
        }
        av.push(v);
      }

      return av;
    }

    request = {};

    request.fire = function(isdate, iedate, step, callback_done) {
      var a_values = []; /* Store partial values from librato */

      /*
       * Librato has a limit in the number of measurements we get back in a request (100).
       * We recursively perform requests to the API to ensure we have all the data points
       * for the interval we are working on.
       */
      function actual_request(full_url) {
        d3.json(full_url)
          .header("X-Requested-With", "XMLHttpRequest")
          .header("Authorization", auth_string)
          .header("Librato-User-Agent", 'cubism/' + cubism.version)
          .get(function (error, data) { /* Callback; data available */
            if (!error) {
              if (data.measurements.length === 0) {
                return
              }
              data.measurements[0].series.forEach(function(o) { a_values.push(o); });

              var still_more_values = 'query' in data && 'next_time' in data.query;
              if (still_more_values) {
                actual_request(make_url(data.query.next_time, iedate, step));
              } else {
                var a_adjusted = down_up_sampling(isdate, iedate, step, a_values);
                callback_done(a_adjusted);
              }
            }
          });
      }

      actual_request(make_url(isdate, iedate, step));
    };

    return request;
  };

  /*
   * The user will use this method to create a cubism source (librato in this case)
   * and call .metric() as necessary to create metrics.
   */
  source.metric = function(m_composite) {
    return context.metric(function(start, stop, step, callback) {
      /* All the librato logic is here; .fire() retrieves the metrics' data */
      librato_request(m_composite)
        .fire(cubism_libratoFormatDate(start),
              cubism_libratoFormatDate(stop),
              cubism_libratoFormatDate(step),
              function(a_values) { callback(null, a_values); });

      }, m_composite += "");
    };

  /* This is not used when the source is librato */
  source.toString = function() {
    return "librato";
  };

  return source;
};

var cubism_libratoFormatDate = function(time) {
  return Math.floor(time / 1000);
};
cubism_contextPrototype.graphite = function(host) {
  if (!arguments.length) host = "";
  var source = {},
      context = this;

  source.metric = function(expression) {
    var sum = "sum";

    var metric = context.metric(function(start, stop, step, callback) {
      var target = expression;

      // Apply the summarize, if necessary.
      if (step !== 1e4) target = "summarize(" + target + ",'"
          + (!(step % 36e5) ? step / 36e5 + "hour" : !(step % 6e4) ? step / 6e4 + "min" : step / 1e3 + "sec")
          + "','" + sum + "')";

      d3.text(host + "/render?format=raw"
          + "&target=" + encodeURIComponent("alias(" + target + ",'')")
          + "&from=" + cubism_graphiteFormatDate(start - 2 * step) // off-by-two?
          + "&until=" + cubism_graphiteFormatDate(stop - 1000), function(text) {
        if (!text) return callback(new Error("unable to load data"));
        callback(null, cubism_graphiteParse(text));
      });
    }, expression += "");

    metric.summarize = function(_) {
      sum = _;
      return metric;
    };

    return metric;
  };

  source.find = function(pattern, callback) {
    d3.json(host + "/metrics/find?format=completer"
        + "&query=" + encodeURIComponent(pattern), function(result) {
      if (!result) return callback(new Error("unable to find metrics"));
      callback(null, result.metrics.map(function(d) { return d.path; }));
    });
  };

  // Returns the graphite host.
  source.toString = function() {
    return host;
  };

  return source;
};

// Graphite understands seconds since UNIX epoch.
function cubism_graphiteFormatDate(time) {
  return Math.floor(time / 1000);
}

// Helper method for parsing graphite's raw format.
function cubism_graphiteParse(text) {
  var i = text.indexOf("|"),
      meta = text.substring(0, i),
      c = meta.lastIndexOf(","),
      b = meta.lastIndexOf(",", c - 1),
      a = meta.lastIndexOf(",", b - 1),
      start = meta.substring(a + 1, b) * 1000,
      step = meta.substring(c + 1) * 1000;
  return text
      .substring(i + 1)
      .split(",")
      .slice(1) // the first value is always None?
      .map(function(d) { return +d; });
}
cubism_contextPrototype.gangliaWeb = function(config) {
  var host = '',
      uriPathPrefix = '/ganglia2/';
 
  if (arguments.length) {
    if (config.host) {
      host = config.host;
    }

    if (config.uriPathPrefix) {
      uriPathPrefix = config.uriPathPrefix;

      /* Add leading and trailing slashes, as appropriate. */
      if( uriPathPrefix[0] != '/' ) {
        uriPathPrefix = '/' + uriPathPrefix;
      }

      if( uriPathPrefix[uriPathPrefix.length - 1] != '/' ) {
        uriPathPrefix += '/';
      }
    }
  }

  var source = {},
      context = this;

  source.metric = function(metricInfo) {

    /* Store the members from metricInfo into local variables. */
    var clusterName = metricInfo.clusterName, 
        metricName = metricInfo.metricName, 
        hostName = metricInfo.hostName,
        isReport = metricInfo.isReport || false,
        titleGenerator = metricInfo.titleGenerator ||
          /* Reasonable (not necessarily pretty) default for titleGenerator. */
          function(unusedMetricInfo) {
            /* unusedMetricInfo is, well, unused in this default case. */
            return ('clusterName:' + clusterName + 
                    ' metricName:' + metricName +
                    (hostName ? ' hostName:' + hostName : ''));
          },
        onChangeCallback = metricInfo.onChangeCallback;
    
    /* Default to plain, simple metrics. */
    var metricKeyName = isReport ? 'g' : 'm';

    var gangliaWebMetric = context.metric(function(start, stop, step, callback) {

      function constructGangliaWebRequestQueryParams() {
        return ('c=' + clusterName +
                '&' + metricKeyName + '=' + metricName + 
                (hostName ? '&h=' + hostName : '') + 
                '&cs=' + start/1000 + '&ce=' + stop/1000 + '&step=' + step/1000 + '&graphlot=1');
      }

      d3.json(host + uriPathPrefix + 'graph.php?' + constructGangliaWebRequestQueryParams(),
        function(result) {
          if( !result ) {
            return callback(new Error("Unable to fetch GangliaWeb data"));
          }

          callback(null, result[0].data);
        });

    }, titleGenerator(metricInfo));

    gangliaWebMetric.toString = function() {
      return titleGenerator(metricInfo);
    };

    /* Allow users to run their custom code each time a gangliaWebMetric changes.
     *
     * TODO Consider abstracting away the naked Cubism call, and instead exposing 
     * a callback that takes in the values array (maybe alongwith the original
     * start and stop 'naked' parameters), since it's handy to have the entire
     * dataset at your disposal (and users will likely implement onChangeCallback
     * primarily to get at this dataset).
     */
    if (onChangeCallback) {
      gangliaWebMetric.on('change', onChangeCallback);
    }

    return gangliaWebMetric;
  };

  // Returns the gangliaWeb host + uriPathPrefix.
  source.toString = function() {
    return host + uriPathPrefix;
  };

  return source;
};

cubism_contextPrototype.linechart = function() {
  var context = this,
      width = context.size(),
      height = 30,
      summarize = function(d) { if (d.length > 0) { return d[0]; } else { return 0; } }
      scale = d3.scale.linear().interpolate(d3.interpolateRound),
      metrics = cubism_identity,
      title = cubism_identity,
      format = d3.format("f"),
      tickFormat = function(d) { if (d > 0) { return  d; } }
      colors = ["#08519c","#74c476","#6baed6","#006d2c","#3182bd","#bae4b3","#bdd7e7","#31a354"],
      step = 1,
      stroke_width = 1,
      axis_width = 0,
      tick_position = [0.4, 0.8],
      auto_min = false,
      auto_max = true;

  function linechart(selection) {

    selection
      .on("mousemove.linechart", function() { context.focus(Math.round(d3.mouse(this)[0])); })
      .on("mouseout.linechart", function() { context.focus(null); });

    selection.append("svg")
      .attr("width", width)
      .attr("height", height);

    selection.each(function(d, i) {

      var that = this,
          metrics_ = typeof metrics === "function" ? metrics.call(that, d, i) : metrics,
          id = ++cubism_id,
          line = d3.svg.line().interpolate("basis"),
          svg = d3.select(that).select("svg"),
          ready = 0;

      function change() {
        if (metrics_.length == 0)
            return;

        var data_set = [],
            data_len = 0,
            data_max = 0,
            data_min = Infinity;

        for (var m in metrics_) {
          var data = [],
              i = 0;

          while (i < context.size()) {
            var window = [];

            for (var j = 0; j < step && i < context.size(); ++j, ++i) {
              window.push(metrics_[m].valueAt(i));
            }

            var value = summarize(window);
            if (isFinite(value)) {
              data.push(value);
            } else {
              data.push(0);
            }
          }

          data_set.push(data);
          data_len = data.length;

          var mm, nn, hh;

          /* the real mininum and maxinum value in the current dataset */
          mm = d3.max(data);
          nn = d3.min(data);

          /* constant value */
          if (mm == nn) {
            /* if mm is zero, display a default range from -10 to 10 */
            hh = Math.min(10, mm * 0.2);
            max = mm + hh;
            min = mm - hh;
          }
          /* there is a range, make it look nice */
          else {
            hh = Math.pow(10, Math.floor(Math.log(mm < 1 ? 1 : mm) / Math.LN10));
            while (hh > (mm - nn) / 2)
              hh = hh / 10;
            min = Math.floor(nn / hh) * hh;
            max = (1 + Math.floor(mm / hh)) * hh
          }

          if (auto_min) data_min = Math.min(data_min, min);
          if (auto_max) data_max = Math.max(data_max, max);
        }

        if (!isFinite(data_max))
          return;
        if (!isFinite(data_min))
          data_min = 0;

        var x = d3.scale.linear().domain([0, data_len]).range([0, width]);
        var y = scale.domain([data_max, data_min]).range([0, height]);

        line.x(function(d, i) { return x(i); })
            .y(function(d) { return y(d); });

        svg.selectAll("path").remove();
        svg.selectAll("g").remove();

        svg.append("g")
          .attr("class", "left axis")
          .attr("transform", "translate(" + axis_width + ", 0)")
          .call(d3.svg.axis()
                .scale(y)
                .tickValues(tick_position.map(function(x) {
                  return x * data_max + (1 - x) * data_min;
                }))
                .orient("left")
                .tickFormat(tickFormat)
               );

        var data_offset = Math.floor(axis_width * data_len / width);
        for (var d in data_set) {
          svg.append("path").attr("d", line(data_set[d].slice(data_offset)))
            .attr("transform", "translate(" + axis_width + ", 0)")
            .attr("width", width - axis_width)
            .attr("stroke", colors[d])
            .attr("stroke-width", stroke_width)
            .attr("fill", "none");
        }

        svg.append("g").attr("class", "toolpit");

        svg.select(".toolpit").append("rect")
          .attr("class", "toolpit-rect")
          .attr("x", 5)
          .attr("rx", 5)
          .attr("ry", 5)
          .attr("stroke", "grey")
          .attr("stroke-width", 2)
          .attr("fill", "rgb(255,255,255)")
          .attr("fill-opacity", 0.8);

        svg.select(".toolpit").append("text")
          .attr("class", "toolpit-text")
          .attr("font-family", "courier")
          .attr("font-size", 12);

        ready += 1;
      }

      function focus(i) {
        if (i == null)
          i = width - 1;

        if (metrics.length == 0)
          return;

        svg.select(".toolpit-text").selectAll("tspan").remove();

        for (var m in metrics_) {
          var ppp = width / context.size(); // pixel_per_point
          if (ppp > 1) {
            var p0 = Math.floor(i / ppp);
            var p1 = p0 + 1;
            var pr = i / ppp - p0;
            var value = (1 - pr) * metrics_[m].valueAt(p0) + pr * metrics_[m].valueAt(p1);
          } else {
            var value = metrics_[m].valueAt(i);
          }

          svg.select(".toolpit-text").append("tspan")
            .attr("x", 10).attr("y", 15 + 15 * m)
            .attr("style", "font-weight:bold")
            .text(metrics_[m].toString() + ": ");

          svg.select(".toolpit-text").append("tspan")
            .attr("y", 15 + 15 * m)
            .attr("style", "stroke:" + colors[m])
            .text(isNaN(value) ? "n/a" : format(value));
        }

        var txt_width = 10,
            txt_height = 10;
        svg.select(".toolpit-text").each(function() {
          txt_width = Math.max(txt_width, this.getBBox().width + 10);
          txt_height = Math.max(txt_height, this.getBBox().height + 10);
        });

        var dx = (i < width - txt_width - 10) ? i : i - txt_width - 10,
            dy = 0.9 * height - txt_height;
        svg.select(".toolpit").attr("transform", "translate(" + dx + ", " + dy + ")");
        svg.select(".toolpit-rect").attr("width", txt_width);
        svg.select(".toolpit-rect").attr("height", txt_height);
      }

      // Update the chart when the context changes.
      context.on("change.linechart-" + id, change);
      context.on("focus.linechart-" + id, focus);

      for (var m in metrics_) {
        metrics_[m].on("change.linechart-" + id, function(start, stop) {
          change(), focus();
          if (ready == metrics_.length) metrics_[m].on("change.linechart-" + id, cubism_identity);
        });
      }
    });
  }

  linechart.remove = function(selection) {

    selection
        .on("mousemove.linechart", null)
        .on("mouseout.linechart", null);

    selection.selectAll("svg")
        .each(remove)
        .remove();

    selection.selectAll(".toolpit")
        .remove();

    function remove(d) {
      d.metrics[0].on("change.linechart-" + d.id, null);
      context.on("change.linechart-" + d.id, null);
      context.on("focus.linechart-" + d.id, null);
    }
  };

  linechart.height = function(_) {
    if (!arguments.length) return height;
    height = +_;
    return linechart;
  };

  linechart.width = function(_) {
    if (!arguments.length) return width;
    width = +_;
    return linechart;
  };

  linechart.summarize = function(_) {
    if (!arguments.length) return summarize;
    summarize = _;
    return linechart;
  };

  linechart.metrics = function(_) {
    if (!arguments.length) return metrics;
    metrics = _;
    return linechart;
  };

  linechart.scale = function(_) {
    if (!arguments.length) return scale;
    scale = _;
    return linechart;
  };

  linechart.title = function(_) {
    if (!arguments.length) return title;
    title = _;
    return linechart;
  };

  linechart.format = function(_) {
    if (!arguments.length) return format;
    format = _;
    return linechart;
  };

  linechart.tickFormat = function(_) {
    if (!arguments.length) return tickFormat;
    tickFormat = _;
    return linechart;
  };

  linechart.colors = function(_) {
    if (!arguments.length) return colors;
    colors = _;
    return linechart;
  };

  linechart.step = function(_) {
    if (!arguments.length) return step;
    if (+_ > 0) step = +_;
    return linechart;
  };

  linechart.stroke_width = function(_) {
    if (!arguments.length) return stroke_width;
    stroke_width = _;
    return linechart;
  };

  linechart.axis_width = function(_) {
    if (!arguments.length) return axis_width;
    axis_width = +_;
    return linechart;
  };

  linechart.tick_position = function(_) {
    if (!arguments.length) return tick_position;
    tick_position = _;
    return linechart;
  };

  linechart.auto_min = function(_) {
    if (!arguments.length) return auto_min;
    auto_min = _;
    return linechart;
  };

  return linechart;
};

function cubism_metric(context) {
  if (!(context instanceof cubism_context)) throw new Error("invalid context");
  this.context = context;
}

var cubism_metricPrototype = cubism_metric.prototype;

cubism.metric = cubism_metric;

cubism_metricPrototype.valueAt = function() {
  return NaN;
};

cubism_metricPrototype.alias = function(name) {
  this.toString = function() { return name; };
  return this;
};

cubism_metricPrototype.extent = function() {
  var i = 0,
      n = this.context.size(),
      value,
      min = Infinity,
      max = -Infinity;
  while (++i < n) {
    value = this.valueAt(i);
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
};

cubism_metricPrototype.on = function(type, listener) {
  return arguments.length < 2 ? null : this;
};

cubism_metricPrototype.shift = function() {
  return this;
};

cubism_metricPrototype.on = function() {
  return arguments.length < 2 ? null : this;
};

cubism_contextPrototype.metric = function(request, name) {
  var context = this,
      metric = new cubism_metric(context),
      id = ".metric-" + ++cubism_id,
      start = -Infinity,
      stop,
      step = context.step(),
      size = parseInt(context.size()/context.pixelWidth()),
      values = [],
      event = d3.dispatch("change"),
      listening = 0,
      fetching;

  // Prefetch new data into a temporary array.
  function prepare(start1, stop) {
    var curStart = start;
    var steps = Math.min(size, Math.round((start1 - start) / step));
    if (!steps || fetching) return; // already fetched, or fetching!
    fetching = true;
    steps = Math.min(size, steps + cubism_metricOverlap);
    var start0 = new Date(stop - steps * step);
    context.requestCounter(1);
    request(start0, stop, step, function(error, data) {
      context.requestCounter(-1);
      fetching = false;
      if (error) {
          context.isFetchFailing(true);
          start = isFinite(curStart) ? start : curStart;
          return console.warn(error);
      }
      
      context.isFetchFailing(false);    
      var i = isFinite(start) ? Math.round((start0 - start) / step) : 0;
      for (var j = 0, m = data.length; j < m; ++j) values[j + i] = data[j];
      event.change.call(metric, start, stop);
    });
  }

  // When the context changes, switch to the new data, ready-or-not!
  function beforechange(start1, stop1) {
    if (!isFinite(start)) start = start1;
    values.splice(0, Math.max(0, Math.min(size, Math.round((start1 - start) / step))));
    start = start1;
    stop = stop1;
  }

  //
  metric.valueAt = function(i) {
    return values[i];
  };

  //
  metric.shift = function(offset) {
    return context.metric(cubism_metricShift(request, +offset));
  };

  //
  metric.on = function(type, listener) {
    if (!arguments.length) return event.on(type);

    // If there are no listeners, then stop listening to the context,
    // and avoid unnecessary fetches.
    if (listener == null) {
      if (event.on(type) != null && --listening == 0) {
        context.on("prepare" + id, null).on("beforechange" + id, null);
      }
    } else {
      if (event.on(type) == null && ++listening == 1) {
        context.on("prepare" + id, prepare).on("beforechange" + id, beforechange);
      }
    }

    event.on(type, listener);

    // Notify the listener of the current start and stop time, as appropriate.
    // This way, charts can display synchronous metrics immediately.
    if (listener != null) {
      if (/^change(\.|$)/.test(type)) listener.call(context, start, stop);
    }

    return metric;
  };

  //
  if (arguments.length > 1) metric.toString = function() {
    return name;
  };

  return metric;
};

// Number of metric to refetch each period, in case of lag.
var cubism_metricOverlap = 6;

// Wraps the specified request implementation, and shifts time by the given offset.
function cubism_metricShift(request, offset) {
  return function(start, stop, step, callback) {
    request(new Date(+start + offset), new Date(+stop + offset), step, callback);
  };
}
function cubism_metricConstant(context, value) {
  cubism_metric.call(this, context);
  value = +value;
  var name = value + "";
  this.valueOf = function() { return value; };
  this.toString = function() { return name; };
}

var cubism_metricConstantPrototype = cubism_metricConstant.prototype = Object.create(cubism_metric.prototype);

cubism_metricConstantPrototype.valueAt = function() {
  return +this;
};

cubism_metricConstantPrototype.extent = function() {
  return [+this, +this];
};
function cubism_metricOperator(name, operate) {

  function cubism_metricOperator(left, right) {
    if (!(right instanceof cubism_metric)) right = new cubism_metricConstant(left.context, right);
    else if (left.context !== right.context) throw new Error("mismatch context");
    cubism_metric.call(this, left.context);
    this.left = left;
    this.right = right;
    this.toString = function() { return left + " " + name + " " + right; };
  }

  var cubism_metricOperatorPrototype = cubism_metricOperator.prototype = Object.create(cubism_metric.prototype);

  cubism_metricOperatorPrototype.valueAt = function(i) {
    return operate(this.left.valueAt(i), this.right.valueAt(i));
  };

  cubism_metricOperatorPrototype.shift = function(offset) {
    return new cubism_metricOperator(this.left.shift(offset), this.right.shift(offset));
  };

  cubism_metricOperatorPrototype.on = function(type, listener) {
    if (arguments.length < 2) return this.left.on(type);
    this.left.on(type, listener);
    this.right.on(type, listener);
    return this;
  };

  return function(right) {
    return new cubism_metricOperator(this, right);
  };
}

cubism_metricPrototype.add = cubism_metricOperator("+", function(left, right) {
  return left + right;
});

cubism_metricPrototype.subtract = cubism_metricOperator("-", function(left, right) {
  return left - right;
});

cubism_metricPrototype.multiply = cubism_metricOperator("*", function(left, right) {
  return left * right;
});

cubism_metricPrototype.divide = cubism_metricOperator("/", function(left, right) {
  return left / right;
});
cubism_contextPrototype.horizon = function() {
  var context = this,
      mode = "offset",
      buffer = document.createElement("canvas"),
      width = buffer.width = context.size(),
      height = buffer.height = 30,
      scale = d3.scale.linear().interpolate(d3.interpolateRound),
      metric = cubism_identity,
      extent = null,
      title = cubism_identity,
      format = d3.format(".2s"),
      formatNaN = null,
      changeFunc = null, sel = null,
      colors = ["#08519c","#3182bd","#6baed6","#bdd7e7","#bae4b3","#74c476","#31a354","#006d2c"],
      patterns = {}; 
      
  function horizon(selection) {
    sel = selection;
    selection
        .on("mousemove.horizon", function() { context.focus(Math.round(d3.mouse(this)[0])); })
        .on("mouseout.horizon", function() { context.focus(null); });

    selection.append("canvas")
        .attr("width", width)
        .attr("height", height);

    selection.append("span")
        .attr("class", "title")
        .text(title);

    selection.append("span")
        .attr("class", "value");

    selection.each(function(d, i) {
      var that = this,
          id = ++cubism_id,
          metric_ = typeof metric === "function" ? metric.call(that, d, i) : metric,
          colors_ = typeof colors === "function" ? colors.call(that, d, i) : colors,
          extent_ = extent,
          start = -Infinity,
          step = context.step(),
          canvas = d3.select(that).select("canvas"),
          span = d3.select(that).select(".value"),
          max_,
          m = colors_.length >> 1,
          ready;

      canvas.datum({id: id, metric: metric_});
      canvas = canvas.node().getContext("2d");

      function change(start1, stop) {
        canvas.save();
        
        // compute the new extent and ready flag
        var extent = metric_.extent();
        var pixelWidth = context.pixelWidth();
        ready = extent.every(isFinite);
        var tempExtent = null;
        if (extent_ != null) tempExtent = typeof extent_ === "function" ? extent_.call(that, d, i) : extent_;
        if (tempExtent != null) extent = tempExtent;

        // if this is an update (with no extent change), copy old values!
        var i0 = 0, max = Math.max(-extent[0], extent[1]);
        if (this === context) {
          if (max == max_) {
            var dx = parseInt(((start1 - start) / step) * pixelWidth);
            i0 = width - Math.max(dx, cubism_metricOverlap * pixelWidth);
            if (dx < width) {
              var canvas0 = buffer.getContext("2d");
              canvas0.clearRect(0, 0, width, height);
              canvas0.drawImage(canvas.canvas, dx, 0, width - dx, height, 0, 0, width - dx, height);
              canvas.clearRect(0, 0, width, height);
              canvas.drawImage(canvas0.canvas, 0, 0);
            }
          }
          start = start1;
        }

        // update the domain
        scale.domain([0, max_ = max]);

        // clear for the new data
        canvas.clearRect(i0, 0, width - i0, height);
        
        var negative = false, f, y2;
        var pattern = patterns[pixelWidth + ''] || patterns['1'];      
        
        if(pattern)
            pattern = canvas.createPattern(pattern, 'repeat');
        
        // positive bands
        for (var j = 0; j < m; ++j) {
          canvas.fillStyle = colors_[m + j];
        
          // Adjust the range based on the current band index.
          var y0 = (j - m + 1) * height;
          scale.range([m * height + y0, y0]);
          y0 = scale(0);

          for (var i = parseInt(i0 / pixelWidth), n = width / pixelWidth | 0, y1, x2 = metric_.valueAt(i - 1), x1; i < n; ++i, x2 = x1) {
            x1 = y1 = metric_.valueAt(i);
            
            if (isNaN(y1)) {
                if(pattern) {
                  canvas.fillStyle = pattern;
                  canvas.fillRect(i * pixelWidth, 0, pixelWidth, height);
                }
                
                continue;
            }
            
            if(pixelWidth > 1) {
                x2 = (isNaN(x2) ? x1 : x2) || 0;
                f = ((x1 || 0) - x2) / pixelWidth;
                
                for(var k = 1; k <= pixelWidth; ++k) {
                    y2 = x2 + f * k;
                    if(y2 < 0) {
                        if (!negative) {
                            canvas.translate(0, height);
                            canvas.scale(1, -1);
                            negative = true;
                        }
                        canvas.fillStyle = colors_[m - 1 - j];
                        y2 = scale(-y2);
                    } else {
                        if(negative) {
                            canvas.translate(0, height);
                            canvas.scale(1, -1);
                            negative = false;
                        }
                        
                        canvas.fillStyle = colors_[m + j];
                        y2 = scale(y2);
                    }
                    canvas.fillRect(i * pixelWidth + k - 1, y2, 1, y0 - y2);
                }
            } else {
                if (y1 < 0) {
                    if(!negative) {
                        canvas.translate(0, height);
                        canvas.scale(1, -1);
                        negative = true;
                    }
                    canvas.fillStyle = colors_[m - 1 - j];
                    y1 = scale(-y1);
                } else {
                    if(negative) {
                        canvas.translate(0, -1 * height);
                        canvas.scale(1, 1);
                        negative = false;
                    }

                    canvas.fillStyle = colors_[m + j];
                    y1 = scale(y1);
                }
            
                canvas.fillRect(i * pixelWidth, y1, pixelWidth, y0 - y1);
            }
          }
        }
        
        canvas.restore();
      }

      function focus(i) {
        if (i == null) i = width - 1;
        var value = metric_.valueAt(i / context.pixelWidth() | 0);
        span.datum(value).text(isNaN(value) ? formatNaN : format);
      }

      // Update the chart when the context changes.
      context.on("change.horizon-" + id, change);
      context.on("focus.horizon-" + id, focus);

      // Display the first metric change immediately,
      // but defer subsequent updates to the canvas change.
      // Note that someone still needs to listen to the metric,
      // so that it continues to update automatically.
      metric_.on("change.horizon-" + id, function(start, stop) {
        change(start, stop), focus();
        if (ready) metric_.on("change.horizon-" + id, cubism_identity);
      });
      
      changeFunc = change;
    });
  }

  horizon.remove = function(selection) {

    selection
        .on("mousemove.horizon", null)
        .on("mouseout.horizon", null);

    selection.selectAll("canvas")
        .each(remove)
        .remove();

    selection.selectAll(".title,.value")
        .remove();

    function remove(d) {
      d.metric.on("change.horizon-" + d.id, null);
      context.on("change.horizon-" + d.id, null);
      context.on("focus.horizon-" + d.id, null);
    }
  };
  
  horizon.redraw = function() {
      changeFunc && changeFunc.call(null);
  };

  horizon.mode = function(_) {
    if (!arguments.length) return mode;
    mode = _ + "";
    return horizon;
  };

  horizon.height = function(_) {
    if (!arguments.length) return height;
    buffer.height = height = +_;
    return horizon;
  };

  horizon.metric = function(_) {
    if (!arguments.length) return metric;
    metric = _;
    return horizon;
  };

  horizon.scale = function(_) {
    if (!arguments.length) return scale;
    scale = _;
    return horizon;
  };

  horizon.extent = function(_) {
    if (!arguments.length) return extent;
    extent = _;
    return horizon;
  };

  horizon.title = function(_) {
    if (!arguments.length) return title;
    title = _;
    return horizon;
  };

  horizon.format = function(_) {
    if (!arguments.length) return format;
    format = _;
    return horizon;
  };
  
  horizon.formatNaN = function(_) {
    if (!arguments.length) return formatNaN;
    formatNaN = _;
    return horizon;
  };

  horizon.colors = function(_) {
    if (!arguments.length) return colors;
    colors = _;
    return horizon;
  };
  
  horizon.resize = function(_) {
    if(!arguments.length) return width;
    width = buffer.width = _;
    sel.select("canvas").attr("width", width);
    horizon.redraw();
    return width;
  };
  
  horizon.patterns = function(_) {
    if (!arguments.length) return patterns;
    patterns = _;
    return horizon;
  };

  return horizon;
};
cubism_contextPrototype.comparison = function() {
  var context = this,
      width = context.size(),
      height = 120,
      scale = d3.scale.linear().interpolate(d3.interpolateRound),
      primary = function(d) { return d[0]; },
      secondary = function(d) { return d[1]; },
      extent = null,
      title = cubism_identity,
      formatPrimary = cubism_comparisonPrimaryFormat,
      formatChange = cubism_comparisonChangeFormat,
      colors = ["#9ecae1", "#225b84", "#a1d99b", "#22723a"],
      strokeWidth = 1.5;

  function comparison(selection) {

    selection
        .on("mousemove.comparison", function() { context.focus(Math.round(d3.mouse(this)[0])); })
        .on("mouseout.comparison", function() { context.focus(null); });

    selection.append("canvas")
        .attr("width", width)
        .attr("height", height);

    selection.append("span")
        .attr("class", "title")
        .text(title);

    selection.append("span")
        .attr("class", "value primary");

    selection.append("span")
        .attr("class", "value change");

    selection.each(function(d, i) {
      var that = this,
          id = ++cubism_id,
          primary_ = typeof primary === "function" ? primary.call(that, d, i) : primary,
          secondary_ = typeof secondary === "function" ? secondary.call(that, d, i) : secondary,
          extent_ = typeof extent === "function" ? extent.call(that, d, i) : extent,
          div = d3.select(that),
          canvas = div.select("canvas"),
          spanPrimary = div.select(".value.primary"),
          spanChange = div.select(".value.change"),
          ready;

      canvas.datum({id: id, primary: primary_, secondary: secondary_});
      canvas = canvas.node().getContext("2d");

      function change(start, stop) {
        canvas.save();
        canvas.clearRect(0, 0, width, height);

        // update the scale
        var primaryExtent = primary_.extent(),
            secondaryExtent = secondary_.extent(),
            extent = extent_ == null ? primaryExtent : extent_;
        scale.domain(extent).range([height, 0]);
        ready = primaryExtent.concat(secondaryExtent).every(isFinite);

        // consistent overplotting
        var round = start / context.step() & 1
            ? cubism_comparisonRoundOdd
            : cubism_comparisonRoundEven;

        // positive changes
        canvas.fillStyle = colors[2];
        for (var i = 0, n = width; i < n; ++i) {
          var y0 = scale(primary_.valueAt(i)),
              y1 = scale(secondary_.valueAt(i));
          if (y0 < y1) canvas.fillRect(round(i), y0, 1, y1 - y0);
        }

        // negative changes
        canvas.fillStyle = colors[0];
        for (i = 0; i < n; ++i) {
          var y0 = scale(primary_.valueAt(i)),
              y1 = scale(secondary_.valueAt(i));
          if (y0 > y1) canvas.fillRect(round(i), y1, 1, y0 - y1);
        }

        // positive values
        canvas.fillStyle = colors[3];
        for (i = 0; i < n; ++i) {
          var y0 = scale(primary_.valueAt(i)),
              y1 = scale(secondary_.valueAt(i));
          if (y0 <= y1) canvas.fillRect(round(i), y0, 1, strokeWidth);
        }

        // negative values
        canvas.fillStyle = colors[1];
        for (i = 0; i < n; ++i) {
          var y0 = scale(primary_.valueAt(i)),
              y1 = scale(secondary_.valueAt(i));
          if (y0 > y1) canvas.fillRect(round(i), y0 - strokeWidth, 1, strokeWidth);
        }

        canvas.restore();
      }

      function focus(i) {
        if (i == null) i = width - 1;
        var valuePrimary = primary_.valueAt(i),
            valueSecondary = secondary_.valueAt(i),
            valueChange = (valuePrimary - valueSecondary) / valueSecondary;

        spanPrimary
            .datum(valuePrimary)
            .text(isNaN(valuePrimary) ? null : formatPrimary);

        spanChange
            .datum(valueChange)
            .text(isNaN(valueChange) ? null : formatChange)
            .attr("class", "value change " + (valueChange > 0 ? "positive" : valueChange < 0 ? "negative" : ""));
      }

      // Display the first primary change immediately,
      // but defer subsequent updates to the context change.
      // Note that someone still needs to listen to the metric,
      // so that it continues to update automatically.
      primary_.on("change.comparison-" + id, firstChange);
      secondary_.on("change.comparison-" + id, firstChange);
      function firstChange(start, stop) {
        change(start, stop), focus();
        if (ready) {
          primary_.on("change.comparison-" + id, cubism_identity);
          secondary_.on("change.comparison-" + id, cubism_identity);
        }
      }

      // Update the chart when the context changes.
      context.on("change.comparison-" + id, change);
      context.on("focus.comparison-" + id, focus);
    });
  }

  comparison.remove = function(selection) {

    selection
        .on("mousemove.comparison", null)
        .on("mouseout.comparison", null);

    selection.selectAll("canvas")
        .each(remove)
        .remove();

    selection.selectAll(".title,.value")
        .remove();

    function remove(d) {
      d.primary.on("change.comparison-" + d.id, null);
      d.secondary.on("change.comparison-" + d.id, null);
      context.on("change.comparison-" + d.id, null);
      context.on("focus.comparison-" + d.id, null);
    }
  };

  comparison.height = function(_) {
    if (!arguments.length) return height;
    height = +_;
    return comparison;
  };

  comparison.primary = function(_) {
    if (!arguments.length) return primary;
    primary = _;
    return comparison;
  };

  comparison.secondary = function(_) {
    if (!arguments.length) return secondary;
    secondary = _;
    return comparison;
  };

  comparison.scale = function(_) {
    if (!arguments.length) return scale;
    scale = _;
    return comparison;
  };

  comparison.extent = function(_) {
    if (!arguments.length) return extent;
    extent = _;
    return comparison;
  };

  comparison.title = function(_) {
    if (!arguments.length) return title;
    title = _;
    return comparison;
  };

  comparison.formatPrimary = function(_) {
    if (!arguments.length) return formatPrimary;
    formatPrimary = _;
    return comparison;
  };

  comparison.formatChange = function(_) {
    if (!arguments.length) return formatChange;
    formatChange = _;
    return comparison;
  };

  comparison.colors = function(_) {
    if (!arguments.length) return colors;
    colors = _;
    return comparison;
  };

  comparison.strokeWidth = function(_) {
    if (!arguments.length) return strokeWidth;
    strokeWidth = _;
    return comparison;
  };

  return comparison;
};

var cubism_comparisonPrimaryFormat = d3.format(".2s"),
    cubism_comparisonChangeFormat = d3.format("+.0%");

function cubism_comparisonRoundEven(i) {
  return i & 0xfffffe;
}

function cubism_comparisonRoundOdd(i) {
  return ((i + 1) & 0xfffffe) - 1;
}
cubism_contextPrototype.axis = function() {
    var context = this,
        width = context.size(),
        scale = context.scale,
        axis_ = d3.svg.axis().scale(scale);
  
    var formatDefault = context.step() < 6e4 ? cubism_axisFormatSeconds
        : context.step() < 864e5 ? cubism_axisFormatMinutes
        : cubism_axisFormatDays;
    var format = formatDefault;
  
    function axis(selection) {
      var id = ++cubism_id,
          tick;
  
      var g = selection.append("svg")
          .datum({id: id})
          .attr("width", width)
          .attr("height", Math.max(28, -axis.tickSize()))
        .append("g")
          .attr("transform", "translate(0," + (axis_.orient() === "top" ? 27 : 4) + ")")
          .call(axis_);
  
      context.on("change.axis-" + id, function() {
        g.call(axis_);
        if (!tick) tick = d3.select(g.node().appendChild(g.selectAll("text").node().cloneNode(true)))
            .style("display", "none")
            .text(null);
      });
  
      context.on("focus.axis-" + id, function(i) {
        var pixelWidth = context.pixelWidth();
        if (tick) {
          if (i == null) {
              tick.style("display", "none");
              g.selectAll("text").style("fill-opacity", null);
          } else {
              
              i = (i / pixelWidth | 0) * pixelWidth;
              tick.style("display", null).text(format(scale.invert(i)));
              var dx = tick.node().getComputedTextLength() + 6;
              var dxt = (dx - 6) / 2;
  
              if (i + dxt > width) 
                  i = width - dxt;
              else if (i - dxt < 0)
                  i = dxt;
  
              tick.attr('x', i);
              g.selectAll("text").style("opacity", function(d) { return Math.abs(scale(d) - i) < dx ? 0 : 1; });
          }
        }
      });
    }
  
    axis.remove = function(selection) {
  
      selection.selectAll("svg")
          .each(remove)
          .remove();
  
      function remove(d) {
        context.on("change.axis-" + d.id, null);
        context.on("focus.axis-" + d.id, null);
      }
    };
  
    axis.width = function(_) {
      if (!arguments.length) return width;
      width = +_;
      scale = context.scale.range([0, width]);
      axis_ = axis_.scale(scale);
    };
    
    axis.focusFormat = function(_) {
      if (!arguments.length) return format == formatDefault ? null : _;
      format = _ == null ? formatDefault : _;
      return axis;
    };
  
    return d3.rebind(axis, axis_,
        "orient",
        "ticks",
        "tickSubdivide",
        "tickSize",
        "tickPadding",
        "tickFormat");
  };
  
  var cubism_axisFormatSeconds = d3.time.format("%I:%M:%S %p"),
      cubism_axisFormatMinutes = d3.time.format("%I:%M %p"),
      cubism_axisFormatDays = d3.time.format("%B %d");
cubism_contextPrototype.rule = function() {
  var context = this,
      metric = cubism_identity;
        
    function cubism_ruleStyle(line) {
      var pixelWidth = context.pixelWidth();
      line
          .style("position", "absolute")
          .style("top", 0)
          .style("bottom", 0)
          .style("width", pixelWidth + "px")
          .style("pointer-events", "none");
    }
  
    function cubism_ruleLeft(i) {
      var pixelWidth = context.pixelWidth();  
      return (i / pixelWidth | 0) * pixelWidth + "px";
    }
  
    function rule(selection) {
      var id = ++cubism_id;
  
      var line = selection.append("div")
          .datum({id: id})
          .attr("class", "line")
          .call(cubism_ruleStyle);
  
      selection.each(function(d, i) {
        var that = this,
            id = ++cubism_id,
            metric_ = typeof metric === "function" ? metric.call(that, d, i) : metric;
  
        if (!metric_) return;
  
        function change(start, stop) {
          var values = [];
  
          for (var i = 0, n = context.size(); i < n; ++i) {
            if (metric_.valueAt(i)) {
              values.push(i);
            }
          }
  
          var lines = selection.selectAll(".metric").data(values);
          lines.exit().remove();
          lines.enter().append("div").attr("class", "metric line").call(cubism_ruleStyle);
          lines.style("left", cubism_ruleLeft);
        }
  
        context.on("change.rule-" + id, change);
        metric_.on("change.rule-" + id, change);
      });
  
      context.on("focus.rule-" + id, function(i) {
        line
            .style("display", i == null ? "none" : null)
            .style("left", i == null ? null : i + 'px');
      });
    }
  
    rule.remove = function(selection) {
  
      selection.selectAll(".line")
          .each(remove)
          .remove();
  
      function remove(d) {
        context.on("focus.rule-" + d.id, null);
      }
    };
  
    rule.metric = function(_) {
      if (!arguments.length) return metric;
      metric = _;
      return rule;
    };
  
    return rule;
  };
  })(this);
