/*
Copyright (c) 2010 Daniel 'Haribo' Evans

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
*/

var jsgraph_graphs = new Array();
var jsgraph_heightSpacing = 10;
var jsgraph_bottomSpace = 0;
var jsgraph_leftSpace = 30;
var jsgraph_rightSpace = 10;
var jsgraph_textcol = "rgb(0,0,0)";
var jsgraph_linecol = "rgb(240,240,240)";
var jsgraph_keyposition = "right";
var jsgraph_barwidth = 1;
var jsgraph_fontname = "sans-serif";
var jsgraph_fontsize = 10;

// Shallow merge functon
function jsgraph_merge(a, b)
{
    var c = {};
    for ( x in a ) c[x] = a[x];
    for ( x in b ) c[x] = b[x];
    return c;
}

function jsgraph_begin()
{
    for (var g = 0; g < jsgraph_graphs.length; g++) {
        jsgraph_graphs[g].draw();
    }
}

function Point(x, y, colour, label)
{
    this.x = x;
    this.y = y;
    this.colour = colour;
    this.label = label;
}

function Series(name, colour)
{
    this.name = name;
    this.colour = colour;
    this.points = new Array();
}

function Graph(title, canvasId, type)
{
    this.defaultOptions = { "type" : "bar",
                            "barOverlap" : false,
                            "barWidth" : 1,
                            "vstep" : "auto",
                            "vstart" : "auto",
                            "vfinish" : "auto",
                            "hstart" : "auto",
                            "hfinish" : "auto",
                            "data" : null,
                            "title" : "",
                            "xlabel" : "",
                            "fillColor" : "",
                            "canvasName" : null }

    if (typeof title == 'object') {
        this.options = jsgraph_merge(this.defaultOptions, title);
    } else {
        this.options = this.defaultOptions;
        this.options.title = title;
        this.options.canvasName = canvasId;
        this.options.type = type;
    }

    this.series = new Array();
    this.lastSeries = new Series('', 'blue');
    this.series[this.series.length] = this.lastSeries;
    this.keypos = jsgraph_keyposition;
    this.start_time = new Date().getTime();

    this.addSeries = function(name, colour)
    {
        this.series[this.series.length] = new Series(name, colour);
        this.lastSeries = this.series[this.series.length - 1];
    }

    this.addPoint = function(x, y, label)
    {
        this.lastSeries.points[this.lastSeries.points.length] = new Point(x, y, this.lastSeries.colour, label);
    }

    this.vmin = function()
    {
        if (this.options.vstart != "auto" && !isNaN(this.options.vstart)) {
            return this.options.vstart;
        }
        var min = 1000000;
        for (var q = 0; q < this.series.length; q++) {
            var ser = this.series[q];
            for (var m = 0; m < ser.points.length; m++) {
                if (ser.points[m].y < min) min = ser.points[m].y;
            }
        }
        if (this.options.type == "bar" && min > 0) {
            // Hack for bar charts, this could be handled much better.
            min = 0;
        }
        return min;
    }

    this.vmax = function()
    {
        if (this.options.vfinish != "auto" && !isNaN(this.options.vfinish)) {
            return this.options.vfinish;
        }
        var max = -1000000;
        for (var q = 0; q < this.series.length; q++) {
            var ser = this.series[q];
            for (var m = 0; m < ser.points.length; m++) {
                if (ser.points[m].y > max) max = ser.points[m].y;
            }
        }
        return max;
    }

    this.min = function()
    {
        if (this.options.hstart != "auto" && !isNaN(this.options.hstart)) {
            return this.options.hstart;
        }
        var min = 1000000;
        for (var q = 0; q < this.series.length; q++) {
            var sers = this.series[q];
            for (var m = 0; m < sers.points.length; m++) {
                if (sers.points[m].x < min) min = sers.points[m].x;
            }
        }
        return min;
    }

    this.max = function()
    {
        if (this.options.hfinish != "auto" && !isNaN(this.options.hfinish)) {
            return this.options.hfinish;
        }
        var max = -1000000;
        for (var q = 0; q < this.series.length; q++) {
            var ser = this.series[q];
            for (var m = 0; m < ser.points.length; m++) {
                if (ser.points[m].x > max) max = ser.points[m].x;
            }
        }
        return max;
    }

    this.range = function()
    {
        var min = this.min();
        var max = this.max();
        if (max - min == 0) return 1;
        return max - min;
    }

    this.vrange = function()
    {
        var min = this.vmin();
        var max = this.vmax();
        if (max - min == 0) return 1;
        return max - min;
    }

    this.draw = function()
    {
        var canvas = document.getElementById(this.options.canvasName);
        var cont = canvas.getContext('2d');

        // Clear the canvas
        if (this.options.fillColor != "") {
            var origFil = cont.fillStyle;
            cont.fillStyle = this.options.fillColor;
            cont.fillRect(0, 0, canvas.width, canvas.height);
            cont.fillStyle = origFil;
        } else {
            canvas.width = canvas.width;
        }

        cont.font = jsgraph_fontsize + "px " + jsgraph_fontname;
        cont.textBaseline = "top";

        var vRange = this.vrange();
        var bottomSpace = jsgraph_bottomSpace || (jsgraph_fontsize + 4);
        if (this.options.xlabel != "") {
            bottomSpace += jsgraph_fontsize + 4;
        }

        var vScale = (canvas.height - 18 - bottomSpace) / this.vrange();
        var vMin = this.vmin();
        var leftSpace = jsgraph_leftSpace;
        var rightSpace = jsgraph_rightSpace;
        var spacing = jsgraph_heightSpacing || (jsgraph_fontsize + 4);

        if (this.keypos != '' && this.lastSeries.name != '') {
            cont.textBaseline = "top";
            // Find the widest series name
            var widest = 1;
            for (var k = 0; k < this.series.length; k++) {
                if (cont.measureText(this.series[k].name).width > widest) widest = cont.measureText(this.series[k].name).width;
            }
            if (this.keypos == 'right') {
                rightSpace += widest + 22;
                cont.strokeRect(canvas.width - rightSpace + 4, 18, widest + 20, ((this.series.length + 1) * 12) + 4);
                cont.fillText("Key", canvas.width - rightSpace + 6, 20);
                for (var k = 0; k < this.series.length; k++) {
                    cont.fillText(this.series[k].name, canvas.width - rightSpace + 18, 20 + (12 * (k + 1)));
                    cont.save();
                    cont.fillStyle = this.series[k].colour;
                    cont.fillRect(canvas.width - rightSpace + 8, 21 + (12 * (k + 1)), 8, 8);
                    cont.restore();
                }
            }
        }

        if (leftSpace < cont.measureText(vMin + vRange).width) leftSpace = cont.measureText(vMin + vRange).width + 2;
        var hScale = (canvas.width - leftSpace - rightSpace) / (this.range() + (this.options.type == "bar" ? 1 : 0));
        var hMin = this.min();

        // Draw title & Labels
        cont.textAlign = "center";
        cont.fillStyle = jsgraph_textcol;
        cont.fillText(this.options.title, (canvas.width - rightSpace - leftSpace) / 2, 1);
        cont.textBaseline = "bottom";
        cont.fillText(this.options.xlabel, (canvas.width - rightSpace - leftSpace) / 2, canvas.height - 2);
        cont.textAlign = "left";

        if (this.options.vstep != "auto" && !isNaN(this.options.vstep)) {
            spacing = this.options.vstep;
        } else {
            while (vRange / spacing >= 10) {
                spacing *= 10;
            }
            while (vRange / spacing <= 2) {
                if (spacing > 1)
                    spacing *= 0.1;
                else
                    spacing *= 0.5;
            }
        }

        var pos = 0;
        for (var i = vMin; i <= vMin + vRange; i += spacing) {
            var y = (canvas.height - bottomSpace) - (i) * vScale + (vMin * vScale);
            if (pos > 0 && pos - y <= jsgraph_fontsize + 4) continue;
            pos = y;
            // Value label
            cont.textBaseline = "bottom";
            cont.textAlign = "right";
            cont.fillStyle = jsgraph_textcol;
            cont.fillText(i + '', leftSpace - 2, y);
            cont.fillStyle = jsgraph_linecol;
            // Horizontal lines
            if (i == vMin || i == vMin + vRange) continue;
            cont.strokeStyle = "rgb(220,220,220)";
            cont.beginPath();
            cont.moveTo(leftSpace, y);
            cont.lineTo(canvas.width - rightSpace, y);
            cont.stroke();
            cont.strokeStyle = "rgb(0,0,0)";
        }

        // Vertical lines with labels
        var pos = 0;
        for (var p = 0; p < this.series[0].points.length; p++) {
            var curr = this.series[0].points[p];
            if (!curr.label) continue;
            var y = canvas.height - bottomSpace;
            var x = hScale * (curr.x - hMin) + leftSpace;
            var tw = cont.measureText(curr.label).width;
            if (pos > 0 && x - pos <= tw + 13) continue;
            pos = x;
            // Time label
            cont.textBaseline = "top";
            cont.textAlign = "center";
            cont.fillStyle = jsgraph_textcol;
            cont.fillText(curr.label, x, y + 3);
            cont.fillStyle = jsgraph_linecol;
            // Vertical line
            if (x <= leftSpace || x >= canvas.width - leftSpace - rightSpace) continue;
            cont.strokeStyle = "rgb(220,220,220)";
            cont.beginPath();
            cont.moveTo(x, y);
            cont.lineTo(x, 18);
            cont.stroke();
            cont.strokeStyle = "rgb(0,0,0)";
        }

        for (var s = 0; s < this.series.length; s++) {
            var series = this.series[s];
            cont.beginPath();
            for (var p = 0; p < series.points.length; p++) {
                var curr = series.points[p];
                // Move point into graph-space
                var height = canvas.height;
                var y = (canvas.height - bottomSpace) - (curr.y) * vScale + (vMin * vScale);
                var x = hScale * (curr.x - hMin) + leftSpace;

                switch (this.options.type) {
                case "line":
                case "scatter":
                    if (this.options.type == "line") {
                        // Main line
                        cont.lineTo(x, y);
                    }
                    // Draw anchor for this point
                    cont.fillStyle = curr.colour;
                    cont.fillRect(x - 2, y - 2, 4, 4);
                    cont.fillStyle = "rgb(0,0,0)";
                    break;

                case "bar":
                    cont.fillStyle = curr.colour;
                    var barwidth = hScale;
                    if (this.options.barWidth != null && this.options.barWidth <= 1) {
                        barwidth *= this.options.barWidth;
                    }
                    var baroffs = ((this.options.barWidth < 1) ? ((1 - this.options.barWidth) / 2) * hScale : 0);
                    barwidth /= (this.options.barOverlap ? 1 : this.series.length);
                    var seriesWidth = (!this.options.barOverlap ? barwidth : 0);
                    cont.fillRect((x + baroffs) + seriesWidth * s, y, barwidth, (curr.y * vScale));
                    cont.fillStyle = "rgb(0,0,0)";
                    break;
                }
            }
            cont.stroke();
        }

        // Draw border of graph
        cont.strokeRect(leftSpace, 18, canvas.width - leftSpace - rightSpace, canvas.height - 18 - bottomSpace);
    }
    jsgraph_graphs[jsgraph_graphs.length] = this;
}
