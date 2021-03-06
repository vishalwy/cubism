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
