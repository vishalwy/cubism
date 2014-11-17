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
      if (tick) {
        if (i == null) {
            tick.style("display", "none");
            g.selectAll("text").style("fill-opacity", null);
        } else {
            i = (i / cubism.pixelWidth | 0) * cubism.pixelWidth;
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
