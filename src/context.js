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
