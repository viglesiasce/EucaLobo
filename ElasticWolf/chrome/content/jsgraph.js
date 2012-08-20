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

var jsgraph_leftSpace = 35;
var jsgraph_rightSpace = 35;
var jsgraph_textcol = "rgb(0,0,0)";
var jsgraph_linecol = "rgb(240,240,240)";
var jsgraph_keyposition = "right";
var jsgraph_barwidth = 1;
var jsgraph_fontname = "sans-serif";
var jsgraph_fontsize = 11;

function Point(x, y, color, label)
{
    this.x = x;
    this.y = y;
    this.color = color;
    this.label = label;
}

function Series(name, color)
{
    this.name = name;
    this.color = color;
    this.points = new Array();
}

function Graph(title, canvasId, type)
{
    this.options = { "type" : "line",
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

    this.options.title = title;
    this.options.canvasName = canvasId;
    this.options.type = type;

    this.series = new Array();
    this.lastSeries = new Series('', 'blue');
    this.series[this.series.length] = this.lastSeries;
    this.keypos = jsgraph_keyposition;

    this.addSeries = function(name, color)
    {
        this.series[this.series.length] = new Series(name, color);
        this.lastSeries = this.series[this.series.length - 1];
    }

    this.addPoint = function(x, y, label)
    {
        this.lastSeries.points[this.lastSeries.points.length] = new Point(x, y, this.lastSeries.color, label);
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
        var ctx = canvas.getContext('2d');

        // Clear the canvas
        if (this.options.fillColor != "") {
            var origFil = ctx.fillStyle;
            ctx.fillStyle = this.options.fillColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = origFil;
        } else {
            canvas.width = canvas.width;
        }

        ctx.font = jsgraph_fontsize + "px " + jsgraph_fontname;
        ctx.textBaseline = "top";
        var hMin = this.min();
        var vMin = this.vmin();
        var vRange = this.vrange();
        var topSpace = jsgraph_fontsize * 1.5;
        var bottomSpace = (jsgraph_fontsize + 4) * (this.options.xlabel ? 2 : 1);
        var leftSpace = jsgraph_leftSpace;
        var rightSpace = jsgraph_rightSpace;

        if (this.keypos != '' && this.lastSeries.name != '') {
            ctx.textBaseline = "top";
            // Find the widest series name
            var widest = 1;
            for (var k = 0; k < this.series.length; k++) {
                if (ctx.measureText(this.series[k].name).width > widest) widest = ctx.measureText(this.series[k].name).width;
            }
            if (this.keypos == 'right') {
                rightSpace += widest + 22;
                ctx.strokeRect(canvas.width - rightSpace + 4, 18, widest + 20, ((this.series.length + 1) * 12) + 4);
                ctx.fillText("Key", canvas.width - rightSpace + 6, 20);
                for (var k = 0; k < this.series.length; k++) {
                    ctx.fillText(this.series[k].name, canvas.width - rightSpace + 18, 20 + (12 * (k + 1)));
                    ctx.save();
                    ctx.fillStyle = this.series[k].color;
                    ctx.fillRect(canvas.width - rightSpace + 8, 21 + (12 * (k + 1)), 8, 8);
                    ctx.restore();
                }
            }
        }

        // Adjust spacing from the left/right based on the labels abd values
        var tw = ctx.measureText((vMin + vRange).toFixed(2)).width;
        if (leftSpace <= tw) leftSpace = tw + 4;

        if (this.series[0].points.length) {
            var label = this.series[0].points[0].label;
            tw = ctx.measureText(label).width;
            if (leftSpace <= tw/2) leftSpace = tw/2 + 4;
            label = this.series[0].points[this.series[0].points.length - 1].label;
            tw = ctx.measureText(label).width;
            if (rightSpace <= tw/2) rightSpace = tw/2 + 4;
        }

        var width = canvas.width - leftSpace - rightSpace;
        var height = canvas.height - topSpace - bottomSpace;
        var vScale = height / this.vrange();
        var hScale = width / (this.range() + (this.options.type == "bar" ? 1 : 0));

        // Draw title & Labels
        ctx.textAlign = "center";
        ctx.fillStyle = jsgraph_textcol;
        ctx.fillText(this.options.title, canvas.width / 2, 2, canvas.width);
        ctx.textBaseline = "bottom";
        ctx.fillText(this.options.xlabel, canvas.width / 2, canvas.height - 2, canvas.width);
        ctx.textAlign = "left";

        if (this.options.vstep != "auto" && !isNaN(this.options.vstep)) {
            spacing = this.options.vstep;
        } else {
            spacing = vRange / jsgraph_fontsize * 2;
        }

        var pos = 0, count = 0;
        for (var i = vMin; i <= vMin + vRange; i += spacing) {
            var y = (canvas.height - bottomSpace) - (i) * vScale + (vMin * vScale);
            if (pos > 0 && pos - y < jsgraph_fontsize * 2) continue;
            pos = y;
            // Value label
            ctx.textBaseline = "bottom";
            ctx.textAlign = "right";
            ctx.fillStyle = jsgraph_textcol;
            ctx.fillText(i.toFixed(2), leftSpace - 2, y);
            ctx.fillStyle = jsgraph_linecol;
            // Horizontal lines
            if (i == vMin || i == vMin + vRange) continue;
            ctx.strokeStyle = "rgb(220,220,220)";
            ctx.beginPath();
            ctx.moveTo(leftSpace, y);
            ctx.lineTo(canvas.width - rightSpace, y);
            ctx.stroke();
            ctx.strokeStyle = "rgb(0,0,0)";
        }

        // Vertical lines with labels
        var pos = 0;
        for (var p = 0; p < this.series[0].points.length; p++) {
            var curr = this.series[0].points[p];
            if (!curr.label) continue;
            var y = canvas.height - bottomSpace;
            var x = hScale * (curr.x - hMin) + leftSpace;
            var tw = ctx.measureText(curr.label).width;
            if (pos > 0 && x - pos <= tw + jsgraph_fontsize + 4) continue;
            pos = x;
            // Time label
            ctx.textBaseline = "top";
            ctx.textAlign = "center";
            ctx.fillStyle = jsgraph_textcol;
            ctx.fillText(curr.label, x, y + 3);
            ctx.fillStyle = jsgraph_linecol;
            // Vertical line
            if (x <= leftSpace || x >= width) continue;
            ctx.strokeStyle = "rgb(220,220,220)";
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, topSpace);
            ctx.stroke();
            ctx.strokeStyle = "rgb(0,0,0)";
        }

        for (var s = 0; s < this.series.length; s++) {
            var series = this.series[s];
            ctx.beginPath();
            for (var p = 0; p < series.points.length; p++) {
                var curr = series.points[p];
                // Move point into graph-space
                var height = canvas.height;
                var y = (canvas.height - bottomSpace) - (curr.y) * vScale + (vMin * vScale);
                var x = hScale * (curr.x - hMin) + leftSpace;
                count++;

                switch (this.options.type) {
                case "line":
                case "scatter":
                    if (this.options.type == "line") {
                        // Main line
                        ctx.lineTo(x, y);
                    }
                    // Draw anchor for this point
                    ctx.fillStyle = curr.color;
                    ctx.fillRect(x - 2, y - 2, 4, 4);
                    ctx.fillStyle = "rgb(0,0,0)";
                    break;

                case "bar":
                    ctx.fillStyle = curr.color;
                    var barwidth = hScale;
                    if (this.options.barWidth != null && this.options.barWidth <= 1) {
                        barwidth *= this.options.barWidth;
                    }
                    var baroffs = ((this.options.barWidth < 1) ? ((1 - this.options.barWidth) / 2) * hScale : 0);
                    barwidth /= (this.options.barOverlap ? 1 : this.series.length);
                    var seriesWidth = (!this.options.barOverlap ? barwidth : 0);
                    ctx.fillRect((x + baroffs) + seriesWidth * s, y, barwidth, (curr.y * vScale));
                    ctx.fillStyle = "rgb(0,0,0)";
                    break;
                }
            }
            ctx.stroke();
        }

        // Draw border of graph
        if (count) {
            ctx.strokeRect(leftSpace, topSpace, canvas.width - leftSpace - rightSpace, canvas.height - topSpace - bottomSpace);
        }
    }
}
