/*
Interactive family tree viewer
Written January 2016 by Jeff Epstein in Brno, Czech Republic
Released under GPL3
*/

"use strict";

// Some formatting options
var verticalMargin = 45;
var horizontalMargin = 35;
var generationLimit = 3;
var nodeBorderMargin = 6;
var mouseClickRadius = 70;

var xhrTimeout = 20000;

var loadImage = function(src) {
    var img = new Image();
    img.src = src;
    return img;
};

var isvisible = function(obj) {
    // http://stackoverflow.com/questions/4795473/check-visibility-of-an-object-with-javascript
    return obj.offsetWidth > 0 && obj.offsetHeight > 0;
};

var addClass = function(node, className) {
    if (node.classList) {
        node.classList.add(className);
    } else {
        var classes = node.className.split(" ");
        classes.addOnce(className);
        node.className = classes.join(" ");
    }
};

var hasClass = function(node, className) {
    if (node.classList)
        return node.classList.contains(className);
    else {
        var classes = node.className.split(" ");
        return classes.indexOf(classname) >= 0;
    }
};

var removeClass = function(node, className) {
    if (node.classList) {
        node.classList.remove(className);
    } else {
        var classes = node.className.split(" ");
        classes.splice(classes.indexOf(className), 1);
        node.className = classes.join(" ");
    }
};

// https://developer.mozilla.org/pl/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
// workaround for old versions of Safari
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
  };
}
if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
      var subjectString = this.toString();
      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}

var java_hashcode = function(s){
    // http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
    var hash = 0;
    if (s.length == 0) return hash;
    for (var i = 0; i < s.length; i++) {
        var char = s.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
};


var resources =
{
    hiddenParentsImage: loadImage('images/uparrow.png'),
    personImage: loadImage('images/person.png'),
    hiddenParentsAndChildrenImage: loadImage('images/doublearrow.png'),
    hiddenChildrenImage: loadImage('images/downarrow.png'),
};

var fetchStaticJsonWithLoadingWindow = function(addr, callback, timeout) {
    var loadingwindow = document.getElementById("loadingwindow");
    var to = setTimeout(function() {
            loadingwindow.style.display = "block";
        }, 500);
    fetchStaticJson(addr, function(js) {
        clearTimeout(to);
        loadingwindow.style.display="none";
        callback(js);
    }, timeout);
};

var fetchStaticJsonWithLoadingPanel = function(addr, callback, timeout) {
    var myloadingscreen = document.createElement("div");
    myloadingscreen.className = "loadingpanel";
    myloadingscreen.appendChild(document.createTextNode("Loading, please wait."));
    showInfoWindow({"text": myloadingscreen});
    fetchStaticJson(addr, function(js) {
        if (js == null) {
            var myerrorscreen = document.createElement("div");
            myerrorscreen.className = "loadingpanel";
            myerrorscreen.appendChild(document.createTextNode("An error occurred while retrieving "+
                "this data. Please refresh the page and try again."));
            showInfoWindow({"text": myerrorscreen});
        }
        else
            callback(js);
    }, timeout);
};

var fetchStaticJsonDelay = function(addr, callback, timeout) {
    setTimeout(function() {
        fetchStaticJson(addr, callback, timeout);
    },3000);
};


var fetchStaticJson = function(addr, callback, timeout) {
    var xhr = new XMLHttpRequest();
    var called = false;
    var started = false;
    var readystatechange = function(evt) {
        var ret = null;
        if (xhr.status && xhr.status != 200) {
            called = true;
            callback(null);
            return;
        }
        // if (xhr.readyState == 2 || xhr.readyState == 3)
        //    started = true;
        if (xhr.readyState == 4) {
                try {
                    ret = JSON.parse(xhr.responseText)
                }
                catch (err) {
                }
                if (!called) {
                    called = true;
                    callback(ret);
                }
        }
    }
    if (timeout)
        setTimeout(function(){
            if (! called && ! started) {
                called=true;
                callback(null);
            }
        },timeout);
    xhr.addEventListener("readystatechange", readystatechange);
    xhr.open("GET", addr, true);

    if (xhr.overrideMimeType) //IE9 does not have this property
       xhr.overrideMimeType("application/json");

    xhr.send(null);
};

var onDemandLoad = function(data, category, callback) {
    var categories = {
        "birthdays": "data/birthdays.json"
    };
    if (data[category])
        callback(data[category]);
    else
        fetchStaticJson(categories[category], function(val) {
            if (val) {
                data[category] = val;
                callback(val);
            }
            else {
                displayError("Can't load data from server. Try refreshing the page.", true);
            }
        }, xhrTimeout);
};

var loadData = function(callback) {
    var files = {
        "structure_raw": "data/structure.json",
        "config": "data/config.json",
        "narratives": "data/narratives.json",
        "pictures": "data/pictures.json",
    }
    var files_keys = Object.keys(files);
    var answers = files_keys.length;
    var errors = 0;
    for (var i=0; i<files_keys.length; i++) {
        var src = files[files_keys[i]];
        (function() {
            var myii = i;
            fetchStaticJson(src, function(js) {
                answers --;
                if (js == null) {
                    errors ++;
                }
                files[files_keys[myii]] = js;
                if (answers == 0) {
                    if (errors == 0) {
                        var structure = {};
                        for (var i=0; i<files["structure_raw"].length;i++)
                            structure[files["structure_raw"][i]["id"]]=files["structure_raw"][i];
                        files["structure"] = structure;
                        files["details"] = {};

                        callback(files);
                    }
                    else
                        callback(null);
                }
                },xhrTimeout);
        })();
    }
};

var jmap = function(fn, arr) {
    var result = [];
    for (var i = 0; i < arr.length; i ++) {
        result.push(fn(arr[i]));
    }
    return result;
};

String.prototype.trim = function() 
{
    return String(this).replace(/^\s+|\s+$/g, '');
};

Array.prototype.addonce = function(val) {
    for (var i = 0, l=this.length; i < l; i++) {
        if (this[i] == val)
            return;
    }
    this.push(val);
};

//    http://stackoverflow.com/questions/7837456/how-to-compare-arrays-in-javascript
Array.prototype.equals = function(array) {
    if (!array)
        return false;

    if (this.length != array.length)
        return false;

    for (var i = 0, l=this.length; i < l; i++) {
        if (this[i] instanceof Array && array[i] instanceof Array) {
            if (!this[i].equals(array[i]))
                return false;
        }
        else if (this[i] != array[i]) { 
            return false;   
        }           
    }       
    return true;
};

var sortByGender = function(structure, personList) {
    return personList.slice().sort(function(a,b){return -structure[a]["sex"].localeCompare(structure[b]["sex"])});
};

var displayName = function(n) {
    return n.replace(/\//g,"");
};

var displaySurname = function(n) {
    var names = n.split(" ");
    var surnames = [];
    var insurname = false;
    for (var i=0; i<names.length; i++) {
        if (names[i].startsWith("/"))
            insurname = true;

        if (insurname)
            surnames.push(names[i]);

        if (names[i].endsWith("/"))
            return surnames.join(" ").replace(/\//g, "");
    }
    return "UNKNOWN";
};

var flattenTree = function(node) {
    var all = [];
    var flattenTreeHelper = function(node) {
        var rels = [node].concat(node.ascendents_down).concat(node.descendents_down).concat(node.ascendents_up).concat(node.descendents_up);
        for (var i=0; i<rels.length; i++)
        {
            if (all.indexOf(rels[i]) < 0) {
                all.push(rels[i]);
                flattenTreeHelper(rels[i]);
            }
        }
    }
    flattenTreeHelper(node);
    return all;
};

var Layout = function(person, structure, view) {
/*Based on tree drawing code from here
    https://rachel53461.wordpress.com/2014/04/20/algorithm-for-drawing-trees/*/
    var getSiblings = function(person) {
        var generation = [];
        var parents = structure[person].parents;
        for (var i = 0; i < parents.length; i++) {
            var parentid = parents[i];
            for (var j = 0; j < structure[parentid].children.length; j++) {
                var child = structure[parentid].children[j];
                if (structure[child].parents.slice().sort().equals(structure[person].parents.slice().sort()))
                    generation.addonce(child);
            };
        };
        generation.addonce(person);
        return generation;
    }
    var getSpouses = function(person) {
        // TODO sort m-f
        return structure[person].spouses;
    }
    var getParents = function(person) {        
         return sortByGender(structure, structure[person].parents);
    }
    var getChildren = function(person) {
        var children = [];
        var spouses = getSpouses(person);

        for (var i=0; i<structure[person].children.length; i++)
            if (structure[structure[person].children[i]].parents.length==1)
                children.push(structure[person].children[i]);

        for (var i = 0; i < spouses.length; i++) {
            for (var j = 0; j < structure[person].children.length; j++) {
                if (structure[spouses[i]].children.indexOf(structure[person].children[j]) >= 0) {
                    children.push(structure[person].children[j]);
                }
            }
        }
        return children;
    }
    var mappedNodes = {};
    var makeNode = function(person, generation) {
        if (person in mappedNodes)
            return mappedNodes[person];
        var newNode = null;
        if (getSpouses(person).length == 0) {
            newNode = Node(structure[person]);
            mappedNodes[person] = newNode;
        } else {
            var plist = [person].concat(getSpouses(person));
            newNode = NodeGroup(jmap(function(p){return Node(structure[p])}, plist));
            for (var i=0; i<plist.length; i++)
                mappedNodes[plist[i]] = newNode;
        }
        newNode.generation = generation;
        if (getParents(person).length == 0)
            newNode.ascendents_down = [];
        else if (getParents(person)[0] in mappedNodes)
            newNode.ascendents_down = [makeNode(getParents(person)[0], generation -1 )];
        else
            newNode.ascendents_down = [];
        
        var childs = getChildren(person);
        if (childs.length > 0) {
            if (Math.abs(generation) < generationLimit) {
                newNode.descendents_down = [];
                for (var i=0; i<childs.length; i++)  {
                    var temp = makeNode(childs[i],generation+1);
                    if (temp.ascendents_down.indexOf(newNode)<0)
                        continue;
                    newNode.descendents_down.push(temp);
                }
            }
        }
        newNode.finalizeRelationships(structure);

        return newNode;
    }
    var verticalSpacing = function(view, node_list)
    {
        var maxheights = {};
        for (var i = 0; i<node_list.length; i++)
        {
            var dims = node_list[i].calcDimensions(view);
            var w = dims[0]; var h = dims[1];
            maxheights[node_list[i].generation] = Math.max(maxheights[node_list[i].generation] || 0, h);
        }
        var sumHeights = {};
        sumHeights[0] = 0;
        for (var i = 1; i in maxheights; i++)
            sumHeights[i] = sumHeights[i-1] + maxheights[i-1] + verticalMargin;
        for (var i = -1; i in maxheights; i--)
            sumHeights[i] = sumHeights[i+1] - maxheights[i] - verticalMargin;
        for (var i = 0; i<node_list.length; i++)
        {
            var pos = node_list[i].getPos();
            var x = pos[0]; var y = pos[1];
            node_list[i].setPos(x,sumHeights[node_list[i].generation]);
        }
    }
    var helperIsNodeLeaf = function(node) {
        return node.descendents_down.length == 0;
    }
    var helperIsNodeLeftMost = function(node) {
        if (node.ascendents_down.length == 0)
            return true;
        return node.ascendents_down[0].descendents_down[0] == node;
    }
    var helperGetPreviousSibling = function(node) {
        if (node.ascendents_down.length == 0)
            debug("No ascendents")
        var p = node.ascendents_down[0].descendents_down.indexOf(node);
        if (p <= 0)
            debug("inconsistent tree");
        return node.ascendents_down[0].descendents_down[p-1];
    }
    var getLeftContour = function(node) {
        var getLeftContourHelper = function(node, modSum, values) {
            if (node.generation in values)
                values[node.generation] = Math.min(values[node.generation], node.getX() + modSum);
            else
                values[node.generation] = node.getX() + modSum;

            modSum += node.mod;
            for (var i=0; i<node.descendents_down.length; i++)
                getLeftContourHelper(node.descendents_down[i], modSum, values);
        }
        var values = {};
        getLeftContourHelper(node, 0, values);
        return values;
    }
    var getRightContour = function(node) {
        var getRightContourHelper = function(node, modSum, values) {
            if (node.generation in values)
                values[node.generation] = Math.max(values[node.generation], node.getX() + node.getWidth() + modSum);
            else
                values[node.generation] = node.getX() + node.getWidth() + modSum;

            modSum += node.mod;
            for (var i=0; i<node.descendents_down.length; i++)
                getRightContourHelper(node.descendents_down[i], modSum, values);
        }
        var values = {};
        getRightContourHelper(node, 0, values);
        return values;
    }
    var centerBetweenNodes = function(leftNode, rightNode) {
        var leftIndex = leftNode.ascendents_down[0].descendents_down.indexOf(rightNode);
        var rightIndex = leftNode.ascendents_down[0].descendents_down.indexOf(leftNode);
        var numNodesBetween = (rightIndex - leftIndex) - 1;
        if (numNodesBetween > 0) {
            var distanceBetweenNodes = (leftNode.getX() - (rightNode.getX()+rightNode.getWidth()) ) / (numNodesBetween + 1);

            var count = 1;
            for (var i = leftIndex + 1; i < rightIndex; i++)
            {
                var middleNode = leftNode.ascendents_down[0].descendents_down[i];

                var desiredX = rightNode.getX() + rightNode.getWidth() + (distanceBetweenNodes * count);
                var offset = desiredX - middleNode.getX();
                middleNode.setX(middleNode.getX()+offset);
                middleNode.mod += offset;

                count++;
            }

            checkForConflicts(leftNode);
        }        
    }
    var checkForConflicts = function(node)
    {
        var treeDistance = 30; // minimum distance between cousin nodes
        var shift = 0;
        var nodeCounter = getLeftContour(node);
        if (node.ascendents_down.length == 0)
            return;
        for (var i=0; i<node.ascendents_down[0].descendents_down.length,
            node.ascendents_down[0].descendents_down[i] != node; i++) {
            var sibling = node.ascendents_down[0].descendents_down[i];
            var siblingContour = getRightContour(sibling);

            for (var level = node.generation + 1; level in nodeCounter && level in siblingContour; level ++) {
                var dist = nodeCounter[level] - siblingContour[level];
                if (dist + shift < treeDistance)
                    shift = treeDistance - dist;
            }
            if (shift > 0) {
                node.setX(node.getX() + shift);
                node.mod += shift;
                // TODO BUG For the time being, this call breaks certain tree constructions.
                // I suspect that it isn't adequately dealing with issues of variable node width.
                // centerBetweenNodes(node, sibling);
                shift = 0;

                // After adjustment, update the contour of the changed nodes
                nodeCounter = getLeftContour(node);
            }
        }
    }
    var calculateInitialX = function(node)
    {

        for (var i=0; i<node.descendents_down.length; i++)
            calculateInitialX(node.descendents_down[i]);
        if (helperIsNodeLeaf(node)) {
            if (helperIsNodeLeftMost(node))
                node.setX(0);
            else
                node.setX(helperGetPreviousSibling(node).getX() + helperGetPreviousSibling(node).getWidth() + horizontalMargin );
        } else {
            var left = node.descendents_down[0].getX();
            var lastchild = node.descendents_down[node.descendents_down.length-1];
            var right = lastchild.getX() + lastchild.getWidth();
            var mid = (left + right) / 2;
            if (helperIsNodeLeftMost(node))
                node.setX(mid - node.getWidth()/2);
                else {
                var prev = helperGetPreviousSibling(node);
                node.setX(prev.getX() + prev.getWidth() + horizontalMargin);
                node.mod = node.getX() - mid + node.getWidth()/2;
                }
        }
        if (node.descendents_down.length > 0 && !helperIsNodeLeftMost(node))
            checkForConflicts(node);
    }
    var treeExtents = null;
    var calculateFinalPositions = function(node, modSum) {
        node.setX(node.getX() + modSum);
        modSum += node.mod;
        for (var i=0; i<node.descendents_down.length; i++) {
            calculateFinalPositions(node.descendents_down[i], modSum);
        }
        if (treeExtents == null)
            treeExtents = [node.getX(), node.getY(), node.getX()+node.getWidth(), node.getY()+node.getHeight()]
        else {
            var x = treeExtents[0];
            var y = treeExtents[1];
            var x2 = treeExtents[2];
            var y2 = treeExtents[3];
            y = Math.min(y, node.getY());
            x = Math.min(x, node.getX());
            x2 = Math.max(x2, node.getX()+node.getWidth());
            y2 = Math.max(y2, node.getY()+node.getHeight());
            treeExtents = [x,y,x2,y2];
        }
    }
    return {
        getTreeExtents: function() {
            return treeExtents;
        },
        lookupNodeById: function(personid) {
            if (personid in mappedNodes)
                return mappedNodes[personid];
            else
                return null;
        },
        nodes: makeNode(person, 0),
        position : function(view) {
            var allnodes = flattenTree(this.nodes);

            verticalSpacing(view, allnodes);
            calculateInitialX(this.nodes);
            calculateFinalPositions(this.nodes, 0);
        }
    }
};

var TextAttr = function(_size, _font, _style, _color) {

// http://stackoverflow.com/questions/1134586/how-can-you-find-the-height-of-text-on-an-html-canvas
    var determineFontHeight = function(fontStyle) {
        var body = document.getElementsByTagName("body")[0];
        var dummy = document.createElement("div");
        var dummyText = document.createTextNode("M");
        dummy.appendChild(dummyText);
        dummy.setAttribute("style", fontStyle);
        try {
            body.appendChild(dummy);
            return dummy.offsetHeight;
        }
        finally {
            body.removeChild(dummy);
        }
    }
    var size = _size;
    var lastHeight = 0;
    return {
        getSize : function()
        {
            return size;
        },
        setSize : function(s)
        {
            size = s;
            lastHeight = 0;
        },
        getheight : function()
        {
            if (lastHeight == 0) {
                lastHeight = determineFontHeight("font: "+this.astext());
            }
            return lastHeight;
        },
        astext : function()
        {
            return _style +" "+size + "px " + _font;
        },
        apply : function(view)
        {
            view.context.font = this.astext();
            view.context.fillStyle = _color;
        },
    }
};


var baseFont = TextAttr(13, "sans-serif", "normal", "#000000");
var detailFont = TextAttr(10, "sans-serif", "normal", "#808080");
var adFont = TextAttr(13, "serif", "bold", "#98AFC7");
var adFontItalic = TextAttr(13, "serif", "oblique", "#98AFC7");
var adFontSmall = TextAttr(9, "serif", "normal", "#98AFC7");
var allScalingFonts = [baseFont, detailFont];

var renderText = function(_text, _view, _x, _y, real) {
    var x = _x;
    var y = _y;
    var lastFont = baseFont;
    _view.context.textBaseline = "top";
    var maxwidth = 0;
    var linemaxheight = 0;

    var _newtext = [];
    for (var i = 0; i < _text.length; i++) {
        if (typeof _text[i] == "string") {
            var s = _text[i].split("\n");
            for (var j = 0; j < s.length; j++) {
                _newtext.push(s[j]);
                if (j < s.length-1)
                {
                    _newtext.push("\n");
                }
            }
        } else {
            _newtext.push(_text[i]);
        }
    }
    for (var i = 0; i < _newtext.length; i++) {
        var elem = _newtext[i];
        if (typeof elem == "string") {
            if (elem == "\n") { // newline
                x = _x;
                y += linemaxheight;
                linemaxheight = 0;
            } else { // just show the text
                if (real)
                    _view.context.fillText(elem,x,y);
                x += _view.context.measureText(elem).width;
                maxwidth = Math.max(maxwidth, x-_x);
                linemaxheight = Math.max(linemaxheight, lastFont.getheight());
            }
        } else { // it is a TextAttr
            lastFont = elem;
            elem.apply(_view);
        }
    };
    return [maxwidth, (y + linemaxheight) - _y];
};


var simpleLine = function(view, ax, ay, bx, by, width, color)
{
    view.context.strokeStyle = color;
    view.context.lineWidth = width;
    view.context.beginPath();
    view.context.moveTo(ax+view.scrollx,ay+view.scrolly);
    view.context.lineTo(bx+view.scrollx,by+view.scrolly);
    view.context.stroke();
};



var drawParentalLine = function(view, parent, child) {
    var tmp = child.getParentConnectorPoint();
    var childx = tmp[0]; var childy = tmp[1];
    tmp = parent.getChildConnectorPoint();
    var parentx = tmp[0]; var parenty = tmp[1];

    childx+=view.scrollx; childy+=view.scrolly;
    parentx+=view.scrollx; parenty+=view.scrolly;

    view.context.strokeStyle = "#373737";
    view.context.lineWidth = 1;
    view.context.beginPath();
    view.context.moveTo(childx,childy);
    var horizy = childy-verticalMargin/2;
    view.context.lineTo(childx, horizy);
    view.context.lineTo(parentx, horizy);
    view.context.lineTo(parentx, parenty);
    view.context.stroke();
};

var NodeGroup = function(_nodes) {
    var spousalSpacing = 17;
    var minHeight = 0;
    var repositionRelative = function(view) {
        for (var i = 1; i<_nodes.length; i++)
        {
            _nodes[i].setX(_nodes[i-1].getX() + _nodes[i-1].getWidth() + spousalSpacing);
            _nodes[i].setY(_nodes[i-1].getY());
        }
    }
    var cached_dimensions = null;
    return {

        ascendents_up : [],
        descendents_up : [],

        ascendents_down : [],
        descendents_down : [],
        generation : 0,
        mod : 0,
        getInteriorNodeById: function(nodeid) {
            for (var i=0; i<_nodes.length; i++)
                if (_nodes[i].getId() == nodeid)
                    return _nodes[i];
            debug("Hosed node lookup");
            return null;
        },
        finalizeRelationships: function(structure)
        {
            for (var i=0; i<_nodes.length; i++)
            {

                _nodes[i].group=this;

                var prnts = structure[_nodes[i].getId()].parents;
                var display_prnts = [];
                for (var j=0; j<this.ascendents_down.length; j++) {
                    display_prnts = display_prnts.concat(this.ascendents_down[j].getIds());
                }
                for (var j=0; j<prnts.length; j++)
                    if (display_prnts.indexOf(prnts[j])<0)
                        _nodes[i].hidden_parents = true;

                var chlds = structure[_nodes[i].getId()].children;
                var display_chlds = [];
                for (var j=0; j<this.descendents_down.length; j++)
                    display_chlds = display_chlds.concat(this.descendents_down[j].getIds());
                for (var j=0; j<chlds.length; j++)
                    if (display_chlds.indexOf(chlds[j])<0)
                        _nodes[i].hidden_children = true;

                for (var j=0; j<this.descendents_down.length; j++) {
                    var childid = this.descendents_down[j].getId()
                    var parentid = _nodes[i].getId();
                    if (structure[parentid].children.indexOf(childid)>=0)
                        _nodes[i].descendents_down.addonce(this.descendents_down[j]);
                }
            }
        },
        getChildConnectorPoint: function() {
            debug("This function doesn't exist");
        },
        getParentConnectorPoint: function() {
            return _nodes[0].getParentConnectorPoint();
        },
        getId : function()
        {
            return _nodes[0].getId();
        },
        getIds : function()
        {
            var result = [];
            for (var i =0; i<_nodes.length; i++)
                result.push(_nodes[i].getId());
            return result;
        },
        getMembers : function()
        {
            return _nodes;
        },
        getText : function ()
        {
            return "NodeGroup";
        },
        getX: function ()
        {
            return _nodes[0].getX();
        },
        getY: function()
        {
            return _nodes[0].getY();
        },
        setX: function(a)
        {
            _nodes[0].setX(a);
            repositionRelative();
        },
        setY: function(a)
        {
            _nodes[0].setY(a);
            repositionRelative();
        },
        getPos : function()
        {
            return [_nodes[0].getX(),_nodes[0].getY()];
        },
        setPos : function(ax,ay)
        {
            _nodes[0].setX(ax);
            _nodes[0].setY(ay);
            repositionRelative();
        },
        toString : function() {
            return _nodes[0].toString();
        },
        getWidth : function()
        {
            var tmp = this.calcDimensions();
            return tmp[0];
        },
        getHeight : function()
        {
            var tmp = this.calcDimensions();
            return tmp[1];
        },
        calcDimensions : function(view)
        {
            if (cached_dimensions == null) {

                if (view == undefined)
                    debug("premature call to calcDimensions");
                for (var i=0; i<_nodes.length; i++)
                    _nodes[i].calcDimensions(view);

                repositionRelative(view);
                var left = _nodes[0].getX();
                var right = _nodes[_nodes.length-1].getX() + _nodes[_nodes.length-1].getWidth();
                var w = right-left;

                var maxheight=0;
                for (var i=0; i<_nodes.length; i++)
                    maxheight = Math.max(maxheight, _nodes[i].getHeight());
                var h = maxheight;

                cached_dimensions = [w,h];

                minHeight = _nodes[0].getHeight();
                for (var i=1; i<_nodes.length; i++)
                    minHeight = Math.min(minHeight, _nodes[i].getHeight());

            }
            return cached_dimensions;

        },
        hitTest : function(view,x,y) {
            for (var i=0; i<_nodes.length; i++)
            {
                var tmp = _nodes[i].hitTest(view,x,y);
                var isHit = tmp[0];
                var val = tmp[1];
                if (isHit)
                    return [isHit, val];
            }
            return [false, "none"];
        },
        draw : function(view) {
            // draw spouse-connecting line
            var linewidth = 8;
            var y = this.getY()+minHeight/2;
            simpleLine(view, this.getX(), y, 
                this.getX()+this.getWidth(), y, linewidth, "#484848");

            for (var i=0; i<_nodes.length; i++)
                _nodes[i].draw(view);
        },
        drawLines : function(view) {
            // TODO BUG: children who have one parent, and that parent is married,
            // will not get their connecting lines drawn
            for (var i=1; i<_nodes.length; i++)
                _nodes[i].drawLines(view);
        }

    }
};

var Node = function(_person) {

    var text = makeNodeText(_person);
    var text_dimensions = null;

    var bgcolor = {"m": "#a7cbca",
                   "f": "#dfa296",
                   "z": "#d3d3d3",
                }
    var extraWidth = 20;
    var x = 0;
    var y = 0;
    return {

        ascendents_up : [],
        descendents_up : [],

        ascendents_down : [],
        descendents_down : [],
        generation : 0,
        mod : 0,
        hidden_parents: false,
        hidden_children: false,
        focused:false,
        group:null,
        getInteriorNodeById: function(nodeid) {
            return this;
        },
        finalizeRelationships: function(structure)
        {
            var prnts = structure[this.getId()].parents;
            var display_prnts = [];
            for (var j=0; j<this.ascendents_down.length; j++) {
                display_prnts = display_prnts.concat(this.ascendents_down[j].getIds());
            }
            for (var j=0; j<prnts.length; j++)
                if (display_prnts.indexOf(prnts[j])<0)
                    this.hidden_parents = true;


            var chlds = structure[this.getId()].children;
            var display_chlds = [];
            for (var j=0; j<this.descendents_down.length; j++)
                display_chlds = display_chlds.concat(this.descendents_down[j].getIds());
            for (var j=0; j<chlds.length; j++)
                if (display_chlds.indexOf(chlds[j])<0)
                    this.hidden_children = true;
        },
        getChildConnectorPoint: function()
        {
            var ax = x + this.getWidth() / 2;
            var ay = y + this.getHeight();
            return [ax,ay+nodeBorderMargin];
        },
        getParentConnectorPoint: function()
        {
            var ax = x + this.getWidth() / 2;
            var ay = y;
            return [ax,ay-nodeBorderMargin];
        },
        getId : function()
        {
            return _person.id;
        },
        getIds : function()
        {
            return [_person.id];
        },
        getText : function ()
        {
            return _text;
        },
        getX: function ()
        {
            return x;
        },
        getY: function()
        {
            return y;
        },
        setX: function(a)
        {
            x = a;
        },
        setY: function(a)
        {
            y = a;
        },
        getPos : function()
        {
            return [x,y];
        },
        setPos : function(ax,ay)
        {
            x = ax;
            y = ay;
        },
        toString : function() {
            return _person.name;
        },
        getWidth : function()
        {
            var tmp = this.calcDimensions();
            var w = tmp[0];
            return w;
        },
        getHeight : function()
        {
            var tmp = this.calcDimensions();
            var h = tmp[1];
            return h;
        },
        calcDimensions : function(view)
        {
            if (text_dimensions == null)
            {
                if (view == undefined) {
                    debug("calcDimensions called prematurely");
                }
                var tmp = renderText(text, view, x, y, false);
                var w = tmp[0];
                var h = tmp[1];
                w+=extraWidth*2;
                text_dimensions = [w,h];
            }
            return text_dimensions;
        },
        getRect : function(view)
        {
            var tmp = this.calcDimensions(view);
            var w = tmp[0]; var h = tmp[1];
            return [x + view.scrollx - nodeBorderMargin,
                    y + view.scrolly - nodeBorderMargin,
                    w + nodeBorderMargin*2,
                    h + nodeBorderMargin*2];
        },
        hitTest : function(view,x,y) {
            var tmp = this.getRect(view);
            var myx=tmp[0];var myy=tmp[1];var w=tmp[2]; var h=tmp[3];
            var right = myx+w;
            var bottom = myy+h;
            var isHit = (x >= myx) && (x <= right) && (y >= myy) && (y <= bottom);

            var result = [isHit, ["goto", this]];
            if (x<myx+extraWidth)
                result = [isHit, ["info", this]];
            return result;
        },
        draw : function(view) {
                var tmp = this.getPos();
                var x = tmp[0];
                var y = tmp[1];
                x+=view.scrollx;
                y+=view.scrolly;
                var tmp = this.getRect(view);var myx=tmp[0];var myy=tmp[1];var w=tmp[2]; var h=tmp[3];

                if (x > view.canvas.width || x+w<0 ||
                    y > view.canvas.height || y+h<0)
                    return; //don't draw off screen

                view.context.fillStyle = bgcolor[_person["sex"] || "z"];
                view.context.fillRect(myx,myy,w,h);
                var tmp = renderText(text, view, x+extraWidth, y, true);
                var boxw = tmp[0]; var boxh = tmp[1];

                if (this.hidden_parents || this.hidden_children)
                {
                    var image = null;
                    if (this.hidden_parents)
                    {
                        if (this.hidden_children)
                            image = resources.hiddenParentsAndChildrenImage;
                        else
                            image = resources.hiddenParentsImage;
                    } else {
                        image = resources.hiddenChildrenImage;
                    }
                    view.context.drawImage(image, x+this.getWidth()-image.width,y);

                }
                view.context.drawImage(resources.personImage,x,y);

                if (this.focused) {
                    view.context.lineWidth = 5;
                    view.context.strokeStyle = "#4e4eff";
                    view.context.strokeRect(myx+2,myy+2,w-4,h-4);    
                }
                else {
                    view.context.lineWidth = 1;
                    view.context.strokeStyle = "#000000";
                    view.context.strokeRect(myx,myy,w,h);    
                }


        },
        drawLines : function(view) {
            for (var i=0; i<this.descendents_down.length; i++)
            {
                var child = this.descendents_down[i];
                drawParentalLine(view, this, child);
            }
        },
    }
};

var displayError = function(text, fatal) {
    var msg = document.getElementById("message");
    msg.innerHTML=text;
    fadeIn(msg,0.15,"inline-block");
    if (!fatal)
        setTimeout(function(){ fadeOut(msg); }, 3000);
};

var makeEmpty = function(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }        
};

var showInfoWindow = function(content) {
    var textInfo = document.getElementById("textinfo");
    makeEmpty(textInfo);
    textInfo.appendChild(content["text"]);
    textInfo.scrollTop = 0;
    fadeIn(document.getElementById("infowindow"),0.15,"block");
};

var getPicturesFilename = function(data, picid, isthumb) {
    var prefix = "f_";
    if (isthumb) {
        prefix = "t_";
    }
    var dir = data["config"]["pictures_prefix"] || "pictures/"
    return dir+prefix + picid + ".jpg";
};

var makeThumbnailPane = function(view, data, picids) {
    var doPicViewer = function(piclist, picindex) {
        var caption = data["pictures"]["picture_table"][piclist[picindex]]["caption"];
        var dim = data["pictures"]["picture_table"][piclist[picindex]]["dim"].split("x");
        var peers = data["pictures"]["picture_table"][piclist[picindex]]["people"];
        for (var i=0; i<dim.length; i++)
            dim[i]=parseInt(dim[i]);
        var picviewer = document.getElementById("picviewer");
        makeEmpty(picviewer);

        var bg = document.createElement('div');
        bg.className = 'pvBackground';
        picviewer.appendChild(bg);

        var pic = document.createElement('div');
        pic.style.position="absolute";
        var picwidth = dim[0];
        var picheight = dim[1];
        var totalwidth = view.canvas.width;
        var totalheight = view.canvas.height;
        var carouselheight = 100;
        var targetwidth = totalwidth * 0.9;
        var targetheight = totalheight * 0.9 - carouselheight;
        var wscale = 1; var hscale = 1;
        if (picwidth > targetwidth)
            wscale = targetwidth / picwidth;
        if (picheight > targetheight)
            hscale = targetheight / picheight;
        var scale = Math.min(hscale, wscale);
        picwidth *= scale; picheight *= scale;
        pic.style.border = "2px solid black";
        pic.style.left = ((totalwidth - picwidth) / 2)+"px";
        pic.style.top = (((totalheight - picheight - carouselheight) / 2)) +"px";
        var img = loadImage(getPicturesFilename(data, piclist[picindex], false));
        img.height = picheight;
        img.width = picwidth;
        pic.appendChild(img);
        picviewer.appendChild(pic);

        pic.addEventListener("click", function() {
            picviewer.style.display="none";            
        });

        bg.addEventListener("click", function() {
            picviewer.style.display="none";            
        });

        var capdiv = document.createElement('div');
        capdiv.appendChild(document.createTextNode(caption));
        var linkdiv = document.createElement('div');
        linkdiv.style["font-size"] = "90%";
        linkdiv.appendChild(document.createTextNode("People in this image:"));
        var linkClickHandler = function(evt) {
            picviewer.style.display="none";
            var id = evt.currentTarget["data-person_id"];
            view.setFocus(id, true);
        }
        for (var i=0; i< peers.length; i++) {
            var pname = displayName(data["structure"][peers[i]]["name"]);
            var link = document.createElement('a');
            link.appendChild(document.createTextNode(pname));
            link.addEventListener("click", linkClickHandler);
            link["data-person_id"] = peers[i];
            linkdiv.appendChild(link);
        }
        capdiv.style["border-radius"] = "7px 7px 7px 7px";
        capdiv.style.border="1px solid black";
        capdiv.appendChild(linkdiv);
        capdiv.style.position="absolute";
        capdiv.style['background'] = "white";
        capdiv.style["text-align"] = "center";
        capdiv.style["left"] = "20%";
        capdiv.style["top"] = (((totalheight - picheight - carouselheight) / 2)+picheight) +"px";
        capdiv.style["width"] = "60%";
        capdiv.style["font-size"] = "110%";
        picviewer.appendChild(capdiv);

        picviewer.style.display="block";
    }
    var thumbEventListener = function(evt) {
        var piclist = evt.currentTarget["data-picsinfo"];
        var picindex = evt.currentTarget["data-picinfo"];
        doPicViewer(piclist, picindex);
    }
    var thumbspane = document.createElement('div');
    thumbspane.className = "pvThumbspane";
    var some_hidden = false;
    for (var i=0; i< picids.length; i++) {

        var picobj = data["pictures"]["picture_table"][picids[i]];
        var thumbpane = document.createElement('span');
        thumbpane.className = "unselectable";
        if (picobj["tag"] && picobj["tag"] == "ref") {
            thumbpane.className += " pvTagRef pvHidden";
            some_hidden = true;
        }

        thumbpane.appendChild(loadImage(getPicturesFilename(data, picids[i], true)));

        var text = document.createElement('div');
        text.appendChild(document.createTextNode(picobj["caption"]));

        thumbpane.appendChild(text);

        thumbpane.addEventListener("click", thumbEventListener);
        thumbpane["data-picsinfo"] = picids;
        thumbpane["data-picinfo"] = i;

        thumbspane.appendChild(thumbpane);
    }
    if (some_hidden) {
        var toggle_refs = document.createElement('div');
        var a = document.createElement('a');
        var text = document.createTextNode('Show/hide references');
        a.appendChild(text);
        toggle_refs.appendChild(a);
        a.addEventListener("click", function() {
            for (var i=0; i<thumbspane.childNodes.length; i++) {
                var chld = thumbspane.childNodes[i];
                if (hasClass(chld, "pvTagRef")) {
                    if (hasClass(chld, "pvHidden"))
                        removeClass(chld,"pvHidden");
                    else
                        addClass(chld, "pvHidden");
                }
            }
        });
        thumbspane.appendChild(toggle_refs);
    }
    return thumbspane;
};

var getDetails = function(view, data, person) {
    var structure = data["structure"];

    var container = document.createElement('div');

    var names = document.createElement('div');
    names.className = 'detaildatanames';
    container.appendChild(names);
    for (var i=0; i<person.names.length; i++)
    {
        var name = document.createElement('div');
        name.className = 'detaildataname';
        name.appendChild(document.createTextNode((i == 0 ? "" : 'a.k.a. ')+
            displayName(person.names[i]) ));
        names.appendChild(name);
    }
    var tabs = document.createElement('div');
    tabs.className="detailtabselector";
    names.appendChild(tabs);

    var makeEventsPane = function() {
        var div_container=document.createElement('div');
        div_container.className = "detaildatacontainer";

        for (var i=0; i<person["events"].length; i++)
        {
            var ev = person.events[i];
            var div_event = document.createElement('div');
            div_event.className="detaildata";
            var field = function(a,b) {
                var f1 = document.createElement('div');
                f1.className = 'detaildatadate';
                f1.appendChild(document.createTextNode(a));
                div_event.appendChild(f1);
                var f2 = document.createElement('div');
                f2.className = 'detaildatadata';
                if (typeof b == "string")
                    f2.appendChild(document.createTextNode(b));
                else
                    f2.appendChild(b);
                div_event.appendChild(f2);
            }
            var compose = function(ar) {
                if (ar.length == 1) {
                    if (typeof ar == "string")
                        return document.createTextNode(ar);
                    else
                        return ar;
                } else {
                    var composed = document.createElement('div');
                    for (var i=0; i<ar.length; i++)
                    {
                        if (typeof ar[i] == "string")
                            composed.appendChild(document.createTextNode(ar[i]));
                        else
                            composed.appendChild(ar[i]);
                    }
                    return composed;
                }
            }
            var handlePersonLink = function(evt) {
                view.setFocus(evt.currentTarget["data-person_id"], true);
            }
            var makePersonLink = function(id) {
                var a = document.createElement('a');
                a.appendChild(document.createTextNode(displayName(structure[id].name)));
                a["data-person_id"] = id;
                a.addEventListener("click", handlePersonLink);
                return a;
            }
            var putText = function(whereto, text) {
                whereto.appendChild(document.createTextNode(text));
            }
            switch (ev[ev.length-1])
            {
                case "B":
                    var borninfo=document.createElement('span');
                    var where = ev[1] ? " in "+ev[1] : "";
                    putText(borninfo, "born"+where);
                    var parents = structure[person.id].parents;
                    if (parents.length > 0) {
                        putText(borninfo, " to ");
                        for (var j=0; j<parents.length; j++) {
                            borninfo.appendChild(makePersonLink(structure[parents[j]].id));
                            if (j<parents.length-1)
                                putText(borninfo," and ");
                        }
                    }
                    field(ev[0] || "",borninfo);
                    break;
                case "D":
                    var where = ev[1] ? " in "+ev[1] : "";
                    field(ev[0] || "","died"+where);
                    break;
                case "M":
                    if (!ev[1])
                        continue;
                    var where = ev[2] ? " at "+ev[2] :"";
                    field(ev[0],compose(["married ",makePersonLink(ev[1]),where]));
                    break;
                case "V":
                    if (!ev[1])
                        continue;
                    var where = ev[2] ? " at "+ev[2] :"";
                    field(ev[0],compose(["divorced ",makePersonLink(ev[1]),where]));
                    break;
                case "A":
                    if (!ev[1])
                        continue;
                    field(ev[0],"arrived "+ev[1]);
                    break;
                case "L":
                    if (!ev[1])
                        continue;
                    field(ev[0],"departed "+ev[1]);
                    break;
                case "R":
                    field(ev[0],"resided "+ev[1]);
                    break;
                default:
                    debug("Unexpected event type");
            }
            div_container.appendChild(div_event);
        }
        return div_container;
    }
    var makeNotesPane = function() {
        var text = document.createElement('div');
        var lines = person["note"].split("\n");
        for (var i = 0; i<lines.length; i++) {
            var line = document.createElement("p");
            line.appendChild(document.createTextNode(lines[i]));
            text.appendChild(line);
        }
        return text;
    }
    var makePicturesPane = function() {
        var pics = data["pictures"]["people_table"][person["id"]];
        return makeThumbnailPane(view, data, pics);
    }
    var makeBioPane = function() {
        return parseBioText(data["narratives"]["descs"][person["id"]], data, function(evt) {
            var person_id = evt.currentTarget["data-person_id"];
            view.setFocus(person_id, true);
        });
    }

    var makeCitesPane = function() {
        var div = document.createElement('div');
        div.className = 'detaildatacontainer';
        for (var i=0; i<person["cites"].length; i++) {
            var cite = person["cites"][i];
            var title = cite[0];
            var text = cite[1];
            var entry = document.createElement('div');
            entry.className = 'detaildata';
            var subentry = document.createElement('div');
            subentry.className = 'detaildatadata';
            entry.appendChild(subentry);

            subentry.appendChild(document.createTextNode(title));

            var entry_content = document.createElement('div');
            entry_content.className = 'detaildataindent';
            var lines = text.split("\n");
            for (var j=0; j<lines.length; j++) {
                var p = document.createElement("p");
                p.appendChild(document.createTextNode(lines[j]));
                entry_content.appendChild(p);
            }
            subentry.appendChild(entry_content);
            div.appendChild(entry);
        }
        return div;
    }

    var content_container=document.createElement('div');
    container.appendChild(content_container);

    var extrabuttons=[];
    var tabButtonHandler = function(evt) {
        makeEmpty(content_container);
        content_container.appendChild(evt.currentTarget["data-mydiv"]);
    }
    var makeButton = function(title, div) {
        var el = document.createElement('span');
        el.appendChild(document.createTextNode(title));

        el["data-mydiv"] = div;
        el.addEventListener("click",tabButtonHandler);
        return el;
    }
    if (person["events"] && person["events"].length > 0) {
        extrabuttons.push(makeButton("Events", makeEventsPane()));
    }
    if (person["cites"] && person["cites"].length > 0) {
        extrabuttons.push(makeButton("Citations", makeCitesPane()));
    }
    if (person["note"] && person["note"].length > 0) {
        extrabuttons.push(makeButton("Notes", makeNotesPane()));
    }
    if (data["narratives"]["descs"][person["id"]]) {
        extrabuttons.push(makeButton("Bio", makeBioPane()));
    }
    if (data["pictures"]["people_table"][person["id"]]) {
        extrabuttons.push(makeButton("Pictures", makePicturesPane()));
    }
    if (extrabuttons.length>1)
        for (var i=0; i<extrabuttons.length; i++)
            tabs.appendChild(extrabuttons[i]); 
    if (extrabuttons.length > 0)
        content_container.appendChild(extrabuttons[0]["data-mydiv"]);

    return {"text":container};
};

var debug = function(msg) {
    console.log(msg);
};

var makeNodeText = function(person) {
    var makePlace = function(a) {
        var res = a[0];
        if (a[1])
            res+=" in "+a[1];
        return res.trim();
    }
    var birth=makePlace(person["birth"]); 
    var death=makePlace(person["death"]);

    var names = person["name"].split(" ");
    var surnames = [];
    var forenames = [];
    var insurname = false;
    var thename = "";
    for (var i=0; i<names.length; i++) {
        if (names[i].startsWith("/"))
            insurname = true;

        if (insurname)
            surnames.push(names[i].replace(/\//g,""));
        else
            forenames.push(names[i].replace(/\//g,""));

        // name suffixes (Jr, Sr, etd) are placed on the second line with the surname

    }
    thename += forenames.join(" ");
    if (surnames.length > 0 && forenames.length > 0)
        thename += "\n";
    thename += surnames.join(" ");

    var result = [baseFont, thename];
    if (birth)
        result = result.concat([detailFont, "\nborn "+birth]);
    if (death)
        result = result.concat([detailFont, "\ndied "+death]);
    return result;
};

var Tree = function(structure, person_id) {

    var layout = Layout(person_id, structure);

    var positioned = false;

    var nodes = flattenTree(layout.nodes);

    return {
        getTreeExtents: function() {
            return layout.getTreeExtents();
        },
        lookupNodeById: function(personid) {
            var an = layout.lookupNodeById(personid);
            if (an == null)
                return null;
            else
                return an.getInteriorNodeById(personid);
        },
        hitTest : function(view, x,y) {
            for (var i=0; i<nodes.length; i++) {
                var tmp = nodes[i].hitTest(view,x,y);
                var hit=tmp[0]; var kind =tmp[1];
                if (hit)
                    return [nodes[i], kind];
            }
            return [null, "none"];
        },
        position : function(view) {
            layout.position(view);
        },
        draw : function(view) {
            if (!positioned)
            {
                positioned = true;
                this.position(view);
            }
            var recurseDraw = function(node) {
                node.draw(view);
                node.drawLines(view); // TODO separate line drawing into separate pass so strokes can be batched
                for (var i=0; i<node.descendents_down.length; i++)
                    recurseDraw(node.descendents_down[i])
            }
            recurseDraw(layout.nodes);
        }
    }
};

var WidgetManager = function() {

    var initAd = function(view) {
        var text = [adFont, "Family Tree Viewer",adFontItalic," 2.0\n",adFontSmall,"Copyright 2016 Jeff Epstein"];
        var tmp = renderText(text, view, 0, 0, false); var w=tmp[0];var h=tmp[1];

        return {
            draw: function(view) {
                view.context.fillStyle = "#d7d7d7";
                view.context.fillRect(10, view.canvas.height-10-h, 
                    w, h);
                view.context.linewidth = 2;
                view.context.strokeStyle = "#98AFC7";
                view.context.strokeRect(10, view.canvas.height-10-h,
                    w, h);
                renderText(text, view, 10, view.canvas.height-9-h, true);
            },
            hitTest: function(view, mousex, mousey) {
                if (mousex>=10 && mousex<=10+w&&mousey>=view.canvas.height-10-h&&
                    mousey<=view.canvas.height-10) {
                    return [true, "ad"];
                }
                return [false, "none"];
            },
        }
    }
    var widgets = [];
    return {
        init: function(view) {
            widgets = [];
        },
        hitTest: function(view, mousex, mousey) {
            for (var i=0; i<widgets.length; i++) {
                var tmp = widgets[i].hitTest(view, mousex, mousey);
                var ishit = tmp[0]; var data = tmp[1];
                if (ishit)
                    return ["widget", data];
            }
            return [null, "none"];
        },
        draw: function(view) {
            for (var i=0; i<widgets.length; i++)
                widgets[i].draw(view);
        }
    }
};

var View = function(data) {
        var structure = data["structure"];
        var details = data["details"];
        var config = data["config"];
        var findAppropriateAncestor= function(personid) {
            var getGeneration = function(p, g) {
                if (g == 0)
                    return [p];
                var result = [];
                if (!(p in structure))
                    return result;
                var parents = sortByGender(structure, structure[p].parents);
                for (var i=0; i<parents.length; i++)
                    result=result.concat(getGeneration(parents[i],g-1));
                return result;
            }
            var result = null;
            for (var i=2; i>=0; i--)
            {
                var res = getGeneration(personid,i);
                if (res.length>0) {
                    result = res[0];
                    break;
                }
            }
            if (result == null || !(result in structure))
                return null;
            return result;
        }
        return {
        tree: null,
        scrollx : 0,
        scrolly : 0,
        targetx : 0,
        targety : 0,
        dragging : false,
        ismousedown: false,
        lastclickposx : 0,
        lastclickposy : 0,
        lastscrollposx : 0,
        lastscrollposy : 0,
        dragtimer : null,
        canvas : null,
        context : null,
        easeAmount: 0.20,
        widgets: WidgetManager(),
        focusId:null,

        init_canvas : function() {
            var options = {
                // Setting this to false seems to sometimes make the background black on Chromium
                alpha: true,
            }
            this.canvas = document.getElementById("canvas");
            this.context = this.canvas.getContext("2d", options);
        },
        get_mouse_pos : function(evt) {            
            var bRect = this.canvas.getBoundingClientRect();
            var mouseX = (evt.clientX - bRect.left)*(this.canvas.width/bRect.width);
            var mouseY = (evt.clientY - bRect.top)*(this.canvas.height/bRect.height);
            return [mouseX, mouseY];
        },
        get_touch_pos : function(evt) {            
            if (evt.touches.length==0) {
                    return [this.lastclickposx,this.lastclickposy];
                }
            var bRect = this.canvas.getBoundingClientRect();
            var mouseX = (evt.touches[0].clientX - bRect.left)*(this.canvas.width/bRect.width);
            var mouseY = (evt.touches[0].clientY - bRect.top)*(this.canvas.height/bRect.height);
            return [mouseX, mouseY];
        },
        startDragTimer : function()
        {
            var mythis = this;
            if (this.dragtimer != null)
            {
                return;
            }

            this.dragtimer = true;
            var anim = function() {
                mythis.scrollx = mythis.scrollx + mythis.easeAmount*(mythis.targetx - mythis.scrollx);
                mythis.scrolly = mythis.scrolly + mythis.easeAmount*(mythis.targety - mythis.scrolly);
                if ((!mythis.dragging) && (Math.abs(mythis.scrollx - mythis.targetx) < 0.1) 
                    && (Math.abs(mythis.scrolly - mythis.targety) < 0.1)) {
                        mythis.scrollx = mythis.targetx;
                        mythis.scrolly = mythis.targety;
                        mythis.dragtimer = null;
                }
                mythis.redraw();
                if (mythis.dragtimer!=null)
                    requestFrame(anim);
            }
            requestFrame(anim);
        },
        makeTree: function(nodeid) {
            var anc = findAppropriateAncestor(nodeid);
            if (anc == null) {
                displayError("Sorry, I can't find the ancestor with ID \""+nodeid+"\"", true);
                return null;
            }
            var tree = Tree(structure,anc);
            return tree;
        },
        recreateTree: function() {
            this.setFocus(this.focusId, false);
        },
        findScreenCenter: function() {
            var left = 0;
            var top = 0;
            var right = this.canvas.width;
            var bottom = this.canvas.height;

            var infowindow = document.getElementById("infowindow");
            if (isvisible(infowindow)) {
                // hacky check for mobile layout
                if (infowindow.offsetWidth > this.canvas.width * 0.9) {
                    // mobile view
                    bottom -= infowindow.offsetHeight;
                } else {
                    // desktop view
                    right -= infowindow.offsetWidth;
                }
            }

            var narrative = document.getElementById("narrativewindow");
            if (isvisible(narrativewindow)) {
                // hacky check for mobile layout
                if (narrative.offsetWidth > this.canvas.width * 0.9) {
                    // mobile view
                    top += narrativewindow.offsetHeight;
                } else {
                    // desktop view
                    left += narrativewindow.offsetWidth;
                }
            }

            return {"x":left+(right-left) / 2, "y":top+(bottom - top) / 2}; 
        },
        setFocusMaybePosition: function(node, updatehistory) {
            var thenode = this.tree.lookupNodeById(node);
            if (thenode == null)
                this.setFocus(node, updatehistory);
            else {
                var node1 = thenode;
                this.setFocusPosition(node, updatehistory, node1.getX()+this.scrollx, node1.getY()+this.scrolly);
            }
        },
        setFocus: function(node, updatehistory) {
            this.tree = this.makeTree(node);
            if (this.tree == null)
                return;
            this.focusId = node;
            if (updatehistory)
                window.location.hash = node; // TODO maybe do encodeURIComponent

            var thenode = this.tree.lookupNodeById(node);
            this.tree.position(this);

            var the_center= this.findScreenCenter();
            this.scrollx = this.targetx = the_center.x - thenode.getX()-thenode.getWidth()/2;
            this.scrolly = this.targety = the_center.y -thenode.getY()-thenode.getHeight()/2;
            thenode.focused = true; 
            this.canvas.focus();
            this.redraw();

            if (isvisible(document.getElementById("infowindow")))
                this.showDetailedView(node);

        },
        setFocusPosition: function(node,updatehistory,x,y) {
            this.tree = this.makeTree(node);
            if (this.tree == null)
                return;
            this.focusId=node;
            if (updatehistory)
                window.location.hash = node; // TODO maybe do encodeURIComponent

            var thenode = this.tree.lookupNodeById(node);
            this.tree.position(this);
            this.scrollx = x - thenode.getX();
            this.scrolly = y - thenode.getY();
            thenode.focused = true; this.canvas.focus();
            this.redraw();

            if (isvisible(document.getElementById("infowindow")))
                this.showDetailedView(node);

            var the_center= this.findScreenCenter();
            this.targetx = the_center.x - thenode.getX()-thenode.getWidth()/2;
            this.targety = the_center.y - thenode.getY()-thenode.getHeight()/2;
            this.startDragTimer();

        },
        hitTest : function(mousePos) {
            // todo test other, non tree things here
            var tmp = this.widgets.hitTest(this,mousePos[0],mousePos[1]);
            var ishit = tmp[0];
            var data = tmp[1];
            if (ishit!=null)
                return ["widget", data];

            var tmp = this.tree.hitTest(this,mousePos[0],mousePos[1]);
            var ishit = tmp[0];
            var data = tmp[1];
            if (ishit!=null)
                return ["node", data];
            return ["none", null];
        },
        mouseup : function(buttons, mousePos) {
            var wasdragging = this.dragging;
            this.stopDragging();

            if (wasdragging) {
                return;
            }
            // test for node click
            var tmp= this.hitTest(mousePos);
            var wherehit1=tmp[0]; var data1=tmp[1];
            var tmp= this.hitTest([this.lastclickposx,this.lastclickposy]);
            var wherehit2 =tmp[0]; var data2 = tmp[1];
            if (wherehit1 == "node" && wherehit2 == "node") {
                if (data1 == null || data2== null)
                    return;
                var tmp = data1;
                var clicktype=tmp[0]; var node1=tmp[1];
                var tmp = data2;
                var clicktype = tmp[0]; var node2 = tmp[1];
                if (node1 != node2)
                    return;
                if (clicktype == "info")
                {
                    this.showDetailedView(node1.getId());
                }
                this.setFocusPosition(node1.getId(), true, node1.getX()+this.scrollx, node1.getY()+this.scrolly);
            }
        },
        lookupDetails : function(personId, callback) {
            if (personId in details) {
                callback(details[personId]);
                return;
            }
            var bucket = Math.abs(java_hashcode(personId)) % config["partition_details"];
            fetchStaticJsonWithLoadingPanel("data/details"+bucket+".json", function(js) {
                if (js == null) {
                    callback(null);
                } else {
                    var newvalues = Object.keys(js);
                    for (var i=0; i<newvalues.length; i++)
                        details[newvalues[i]] = js[newvalues[i]];
                    if (personId in details)
                        callback(details[personId]);
                    else {
                        debug("Didn't find data in right bucket");
                        callback(null);
                    }
                }
            }, xhrTimeout);
        },
        showDetailedView : function(personId) {
            var mythis = this;
            this.lookupDetails(personId, function(mydetails) {
                if(mydetails == null)
                    displayError("Person lookup failed", true);
                else
                    showInfoWindow(getDetails(mythis, data, mydetails));
            });
        },
        stopDragging: function() {
            this.dragging = false;
            this.ismousedown = false;
            this.adjustVisibleArea();
        },
        mousemove : function(buttons, mousePos) {

            //IE9
            if (window.event) 
                buttons = window.event.button || buttons;

            if (buttons == 0)
            {
                this.stopDragging();
            }
            if (this.dragging)
            {
                var posx = mousePos[0] - this.lastclickposx;
                var posy = mousePos[1] - this.lastclickposy;

                this.targetx = this.lastscrollposx + posx;
                this.targety = this.lastscrollposy + posy;
                this.startDragTimer();
            }
            else if (this.ismousedown) {
                var dx = this.lastclickposx - mousePos[0];
                var dy = this.lastclickposy - mousePos[1];
                var d = Math.sqrt(dx*dx + dy*dy);
                if (d > mouseClickRadius)
                    this.dragging = true;
            }
        },
        mousedown : function(buttons, mousePos) {

            this.lastclickposx = mousePos[0];
            this.lastclickposy = mousePos[1];
            this.lastscrollposx = this.scrollx;
            this.lastscrollposy = this.scrolly;


            //only drag if we click on the background
            if (! this.dragging && this.hitTest(mousePos)[0] == "none")
            {
                this.dragging = true;
            }
            this.ismousedown = true;
        },


        set_canvas_size: function() {
            this.canvas.width = Math.min(window.outerWidth || window.innerWidth, window.innerWidth);
            this.canvas.height = Math.min(window.outerHeight || window.innerHeight, window.innerHeight);
            this.widgets.init(this);
        },


        zoomin: function() {
            if (allScalingFonts[0].getSize() > 30)
                return;
            for (var i=0; i<allScalingFonts.length; i++) {
                var s = allScalingFonts[i].getSize();
                allScalingFonts[i].setSize(s+1);
            }
            this.recreateTree();
        },

        zoomout: function() {
            if (allScalingFonts[0].getSize() < 8)
                return;
            for (var i=0; i<allScalingFonts.length; i++) {
                var s = allScalingFonts[i].getSize();
                allScalingFonts[i].setSize(s-1);
            }
            this.recreateTree();
        },

        init : function(initial_focus) {
            var mythis = this;
            this.init_canvas();
            this.set_canvas_size();
            this.setFocus(initial_focus, false);

            this.canvas.addEventListener("mousedown", function(evt){ mythis.mousedown(evt.buttons, mythis.get_mouse_pos(evt)); }, false);
            this.canvas.addEventListener("mouseup", function(evt){ mythis.mouseup(evt.buttons, mythis.get_mouse_pos(evt)); }, false);
            this.canvas.addEventListener("mousemove", function(evt){ mythis.mousemove(evt.buttons, mythis.get_mouse_pos(evt)); }, false);


            this.canvas.addEventListener("touchstart", function(evt){ 
                mythis.mousedown(1, mythis.get_touch_pos(evt));
                 evt.preventDefault();
                 evt.stopPropagation();}, false);
            this.canvas.addEventListener("touchend", function(evt){ 
                mythis.mouseup(1, mythis.get_touch_pos(evt)); 
                evt.preventDefault();
                evt.stopPropagation();}, false);
            this.canvas.addEventListener("touchmove", function(evt){ 
                mythis.mousemove(1, mythis.get_touch_pos(evt)); 
                evt.stopPropagation();
                evt.preventDefault();}, false);

            this.canvas.addEventListener("keydown", function(evt){
                var newtarget = null;

                //avoid breaking standard system functionality
                if (evt.ctrlKey || evt.altKey)
                    return;
                switch (evt.keyCode) {
                    case 173: case 189://minus
                        mythis.zoomout();
                        evt.preventDefault();
                        break;
                    case 61: case 187://plus
                        mythis.zoomin();
                        evt.preventDefault();
                        break
                    case 38: case 87: //up
                        var myself = mythis.tree.lookupNodeById(mythis.focusId);
                        if (myself.ascendents_down.length>0)
                            newtarget = myself.ascendents_down[0];
                        else if (myself.group && myself.group.ascendents_down.length>0)
                            newtarget=myself.group.ascendents_down[0];
                        evt.preventDefault();
                        break;
                    case 40: case 83: //down
                        var myself = mythis.tree.lookupNodeById(mythis.focusId);
                        if (myself.descendents_down.length>0)
                            newtarget = myself.descendents_down[0];
                        else if (myself.group && myself.group.descendents_down.length>0)
                            newtarget=myself.group.descendents_down[0];
                        evt.preventDefault();
                        break;
                    case 37: case 65: //left
                        var myself = mythis.tree.lookupNodeById(mythis.focusId);
                        var parent = null;
                        if (myself.ascendents_down.length>0)
                            parent = myself.ascendents_down[0];
                        else if (myself.group && myself.group.ascendents_down.length>0)
                            parent =myself.group.ascendents_down[0];
                        if (parent) {
                            var sibs = parent.descendents_down;
                            var i = sibs.indexOf(myself);
                            if (i<0 && myself.group)
                                i = sibs.indexOf(myself.group);
                            if (i > 0)
                                newtarget = sibs[i-1];
                        }
                        evt.preventDefault();
                        break;
                    case 39: case 68: //right
                        var myself = mythis.tree.lookupNodeById(mythis.focusId);
                        var parent = null;
                        if (myself.ascendents_down.length>0)
                            parent = myself.ascendents_down[0];
                        else if (myself.group && myself.group.ascendents_down.length>0)
                            parent =myself.group.ascendents_down[0];
                        if (parent) {
                            var sibs = parent.descendents_down;
                            var i = sibs.indexOf(myself);
                            if (i<0 && myself.group)
                                i = sibs.indexOf(myself.group);
                            if (i < sibs.length-1)
                                newtarget = sibs[i+1];
                        }
                        evt.preventDefault();
                        break;
                    case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // numbers
                        var spousenumber = evt.keyCode - 48;
                        var myself = mythis.tree.lookupNodeById(mythis.focusId);
                        if (myself.group) {
                            var spouses = myself.group.getMembers();
                            if (spousenumber < spouses.length) {
                                newtarget = spouses[spousenumber];
                            }
                        }
                        evt.preventDefault();
                        break;
                }
                if (newtarget != null) {
                    mythis.setFocusPosition(newtarget.getId(), true, newtarget.getX()+mythis.scrollx, newtarget.getY()+mythis.scrolly);

                    //mythis.setFocus(newtarget);
                }
            }, false);
            window.addEventListener("resize", function(evt){
                mythis.set_canvas_size(); 
                mythis.adjustVisibleArea();
                mythis.redraw();}, false);
            window.addEventListener("hashchange", function(evt) {
                var myhash = getHashString();
                if (myhash == "")
                    myhash = initial_focus;
                if (mythis.focusId == myhash)
                    return;
                mythis.setFocus(myhash, false);
            });
        },
        adjustVisibleArea: function() {
            var changed = false;
            var extents = this.tree.getTreeExtents();
            if (extents[2]+this.scrollx < 0) {
                this.targetx = this.canvas.width/2-extents[2];
                changed = true;
            }
            if (extents[3]+this.scrolly < 0) {
                this.targety = this.canvas.height/2-extents[3];
                changed = true;
            }
            if (extents[0]+this.scrollx > this.canvas.width) {
                this.targetx = this.canvas.width/2+extents[0];
                changed = true;
            }
            if (extents[1]+this.scrolly > this.canvas.height) {
                this.targety = this.canvas.height/2-extents[1];
                changed = true;
            }

            if (changed)
                this.startDragTimer();

        },
        redraw : function() {
            this.context.clearRect(0, 0, canvas.width, canvas.height);
            if (this.tree != null)
                this.tree.draw(this);
            this.widgets.draw(this);
        },
    }
};

var getHashString = function() {
    var myhash = window.location.hash;
    if (myhash[0] == "#")
        myhash = myhash.substr(1);
    return decodeURIComponent(myhash);
};

var QueryString = function () {
  var query_string = {};
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
    if (typeof query_string[pair[0]] === "undefined") {
      query_string[pair[0]] = decodeURIComponent(pair[1]);
    } else if (typeof query_string[pair[0]] === "string") {
      var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
      query_string[pair[0]] = arr;
    } else {
      query_string[pair[0]].push(decodeURIComponent(pair[1]));
    }
  } 
    return query_string;
}();

var requestFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

function fadeOut(el, step){
  el.style.opacity = 1;
  step = step || 0.15;
  (function fade() {
    if ((el.style.opacity -= step) < 0) {
      el.style.display = "none";
      el.style.opacity = 0;
    } else {
      requestFrame(fade);
    }
  })();
}

function fadeIn(el, step, display){
    if (el.style.display && el.style.display != "none")
        return;
    el.style.opacity = 0;
    el.style.display = display || "inline";
    step = step || 0.15;

    (function fade() {
      var val = parseFloat(el.style.opacity);
      if (!((val += step) > 1)) {
        el.style.opacity = val;
        requestFrame(fade);
      }   else {el.style.opacity=1;}
    })();
}


var parseBioText = function(text, data, personLinkHandler) {
    var div = document.createElement('div');
    var p = document.createElement('p');

    while (text) {
        var i = text.indexOf("#{");
        if (i<0) {
            p.appendChild(document.createTextNode(text));
            text="";
        } else {
            p.appendChild(document.createTextNode(text.substr(0,i)));
            text = text.substr(i);
            var i2 = text.indexOf("}");
            if (i2 < 0)
                return p; // error, give up
            var link = text.substr(2,i2-2);
            text = text.substr(i2+1);

            if (link == "") {
                div.appendChild(p);
                p=document.createElement('p');
            } else {
                i = link.indexOf(",");
                if (i < 0) {
                    // person link
                    var a = document.createElement('a');
                    var linkedperson = data["structure"][link];
                    if (!linkedperson) {
                        a.appendChild(document.createTextNode("ERROR"));
                        debug("Barfing on link to unknown "+link);
                    } else {
                        a.appendChild(document.createTextNode(displayName(linkedperson["name"])));
                        a["data-person_id"] = link;
                        a.addEventListener("click",personLinkHandler);
                    }
                    p.appendChild(a);
                } else {
                    //html link
                    var target = link.substr(0,i);
                    var linktext = link.substr(i+1);
                    var a = document.createElement('a');
                    a.href = target;
                    a.target="_blank";
                    a.rel="noopener noreferrer"; //https://medium.com/@jitbit/target-blank-the-most-underestimated-vulnerability-ever-96e328301f4c#.hdenh1ez7
                    a.appendChild(document.createTextNode(linktext));
                    p.appendChild(a);
                }
            }
        }
    }

    div.appendChild(p);
    return div;
};


function scrollToY(el, scrollTargetY, speed, easing) {
    //http://stackoverflow.com/questions/12199363/scrollto-with-animation

    var scrollY = el.scrollTop,
        scrollTargetY = scrollTargetY || 0,
        speed = speed || 2000,
        easing = easing || 'easeOutSine',
        currentTime = 0;

    var time = Math.max(.1, Math.min(Math.abs(scrollY - scrollTargetY) / speed, .8));

    var PI_D2 = Math.PI / 2,
        easingEquations = {
            easeOutSine: function (pos) {
                return Math.sin(pos * (Math.PI / 2));
            },
            easeInOutSine: function (pos) {
                return (-0.5 * (Math.cos(Math.PI * pos) - 1));
            },
            easeInOutQuint: function (pos) {
                if ((pos /= 0.5) < 1) {
                    return 0.5 * Math.pow(pos, 5);
                }
                return 0.5 * (Math.pow((pos - 2), 5) + 2);
            }
        };

    function tick() {
        currentTime += 1 / 60;

        var p = currentTime / time;
        var t = easingEquations[easing](p);

        if (p < 1) {
            requestFrame(tick);

            el.scrollTop = (scrollY + ((scrollTargetY - scrollY) * t));
        } else {
            el.scrollTo = scrollTargetY;
        }
    }
    tick();
}

var showNarrative = function(data, view, narrname) {

    var narrativebody = document.getElementById("narrativebody");

    var mkText = function(tag, txt, cls) {
        var el = document.createElement(tag);
        el.appendChild(document.createTextNode(txt));
        if (cls)
            el.className = cls;
        return el;
    };

    var personLinkHandler = function(evt) {
        var person_id = evt.currentTarget["data-person_id"];

        for (var i=0; i<narrativebody.childNodes.length; i++) {
            var child = narrativebody.childNodes[i];
            if (!child["data-person_id"])
                continue;
            if (child["data-person_id"] == person_id) {
                scrollToY(narrativebody, child.offsetTop, 400, 'easeInOutQuint');
                return;
            }
        }

        // Linked person isn't in current narrative, so just show them in the tree
        view.setFocus(person_id, false);
    };

    var relationshipName = function(distance, sex) {
        if (distance == 0)
            return "self";
        var sexmap = {
            "m": "son",
            "f": "daughter"
        }
        var result = sexmap[sex] || "person";
        var count = 0;
        while (count < distance-1) {
            if (count == 0)
                result = "grand" + result;
            else
                result = "great-" + result;
            count++;
        }
        return result;
    };

    var makeSection = function(generation, narrative_indv, person, narrtext) {
        var generation_data = narrative_indv["gen"];
        var personDiv = document.createElement('div');
        var name = displayName(person["name"]);
        personDiv.className = "narrativePerson narrativePerson" + generation;
        personDiv["data-person_id"] = person["id"];

        var dates = "";
        if (person["birth"][0]!="" || person["death"][0]!="")
            dates = person["birth"][0] +"-"+ person["death"][0];

        var lineage = "";
        for (var i=0; i<generation_data.length; i++) {
            var distance = generation_data[i][0];
            var scion = generation_data[i][1];
            var relationship = relationshipName(distance, person["sex"]);
            if (i>0)
                lineage+=", ";
            lineage = lineage + relationship + " of "+displayName(data["structure"][scion]["name"]);
        }

        personDiv.appendChild(mkText('span',name, 'narrative_name'));
        personDiv.appendChild(mkText('span',dates, 'narrative_date'));
        if (generation>0)
            personDiv.appendChild(mkText('div',lineage,'narrative_lineage'));

        if (narrtext) {
            var text = parseBioText(narrtext, data, personLinkHandler);
            personDiv.appendChild(text);
        }
        else {
            var text = "";
            if (person["parents"].length > 0) {
                text += "Born to ";
                for (var i=0; i<person["parents"].length; i++) {
                    if (i!=0)
                        text+=" and "
                    text+="#{" + person["parents"][i]+ "}";
                }
                text += "#{}";
            }
            if (person["children"].length > 0) {
                if (person["children"].length == 1)
                    text += "Had child ";
                else
                    text += "Had children ";
                for (var i=0; i<person["children"].length; i++) {
                    if (i!=0)
                        text+=", "
                    text+="#{" + person["children"][i]+ "}";
                }
                text += "#{}";
            }
            text = parse(text);
            personDiv.appendChild(text);
        }


        if (data["pictures"]["people_table"][person["id"]]) {
            personDiv.appendChild(makeThumbnailPane(view, data, data["pictures"]["people_table"][person["id"]]));
        }

        return personDiv;
    };

    var narr = null;
    for (var i=0; i<data["narratives"]["spec"].length; i++) {
        if (data["narratives"]["spec"][i]["name"] == narrname) {
            narr = data["narratives"]["spec"][i];
            break;
        }
    }
    if (!narr) {
        displayError("Named narrative was not found",false);
        return;
    }
    var indvs = narr["indvs"];

    makeEmpty(narrativebody);

    var section = null;
    var header = mkText("div", "The "+narrname+" Narrative");
    header.className="narrativeHeader";
    narrativebody.appendChild(header);
    for (var i=0; i<indvs.length; i++) {
        var id = indvs[i]["id"];
        var gen = indvs[i]["gen"];
        var primarygen = gen[0][0];
        primarygen = Math.min(5, Math.max(0, primarygen));

        // This conditional skips people for whom I don't have
        // a writen narrative. However. makeSection can generate
        // a stub text with basic information.
        if (data["narratives"]["descs"][id]) {
            section = makeSection(primarygen, indvs[i], data["structure"][id], data["narratives"]["descs"][id]);
            narrativebody.appendChild(section);
        }
    }

    // This is not great, as the size will change if you resize
    // but we need the blank space so you can scroll all the way to the last person
    var blankspace=document.createElement('div');
    var _buffer = null;
    narrativebody.addEventListener("scroll", function(){
        if (!_buffer) {
            _buffer = setInterval(function() {
                var extraSpace = Math.max(0, narrativebody.offsetHeight - section.offsetHeight);    
                blankspace.style["margin-bottom"] = extraSpace+"px";
                _buffer = null;
            }, 300);            
        }
    });
    narrativebody.appendChild(blankspace);

    fadeIn(document.getElementById("infowindow"),0.15,"block");
    fadeIn(narrativewindow,0.15,"block");


    // force a scroll event in a hacky way
    narrativebody["data-last_viewed_person"] = "!";
    narrativebody.scrollTop = 1;
    narrativebody["data-last_viewed_person"] = "";
    narrativebody.scrollTop=0;

};

var initNarrative = function(data, view) {
    document.getElementById("closenarrativewindow").onclick = function(evt) {
        var narrativewindow = document.getElementById("narrativewindow");
        fadeOut(narrativewindow,0.15);
    }
    var narrativelist = document.getElementById("narrativelist");
    var narrativeClickHandler = function(evt) {
        var which = evt.currentTarget["data-narr"];

        showNarrative(data, view, which);
        narrativelist.style.display="none";
    };
    for (var i=0; i< data["narratives"]["spec"].length; i++) {
        var el = document.createElement('div');
        el.appendChild(document.createTextNode(data["narratives"]["spec"][i]["name"]));
        el.addEventListener("click", narrativeClickHandler);
        el.className="searchresult";
        el["data-narr"]=data["narratives"]["spec"][i]["name"];
        narrativelist.appendChild(el);
    }
    if (data["narratives"]["spec"].length == 0)
        document.getElementById("narrativebutton").style.display="none";
    document.getElementById("narrativebutton").addEventListener("click", function(evt) {
        if (narrativelist.style.display=="block") 
            narrativelist.style.display="none";
        else
            narrativelist.style.display="block";
    });

    var narrativebody = document.getElementById("narrativebody");
    var _buffer = null;
    var setHighlight = function(id) {
        for (var i=0; i<narrativebody.childNodes.length; i++) {
            var child = narrativebody.childNodes[i];
            if (!child["data-person_id"])
                continue;
            removeClass(child, "narrativeHighlight");
            if (child["data-person_id"] == id)
                addClass(child, "narrativeHighlight");
        }
    }
    narrativebody.addEventListener("scroll", function(evt) {

        if (!_buffer) {

            _buffer=setTimeout(function() {
                for (var i=0; i<narrativebody.childNodes.length; i++) {
                    var child = narrativebody.childNodes[i];
                    if (!child["data-person_id"])
                        continue;
                    var last = narrativebody["data-last_viewed_person"];
                    if (last == "!")
                        return;
                    if (child.offsetTop >= narrativebody.scrollTop) {
                        var id = child["data-person_id"];
                        if (id != last) {
                            narrativebody["data-last_viewed_person"] = id;
                            setHighlight(id);
                            view.setFocusMaybePosition(id, last == "");
                        }
                        break;
                    }
                }
                _buffer=null;
            }, 300);
        }


    });
};

var initSearch = function(data, view) {
    var structure = data["structure"];
    var nameindex = data["structure_raw"];
    document.getElementById("helpbutton").onclick = function(evt) {
        var helptext=("<b>Welcome to the Family Tree Viewer 2.0</b><br>"+
            "Here are some tips for using the program:<br><ol>"+
            "<li> Move around the tree by clicking and dragging on the background."+
            "<li> You can focus on a family member by clicking on him or her. That person will move to the center of the screen."+
            "<li> Not all family members are shown at once. The <img src=\"images/uparrow.png\"> icon means that the family member has hidden ancestors. The <img src=\"images/downarrow.png\"> means that the family members has hidden children. Focus on a family member to show his or her hidden relatives."+
            "<li> Click on the <img src=\"images/person.png\"> icon to show more details about the person: birth, death, residency, travel, and marriages."+
            "<li> To find a relative by name, type the name into the search box. If you start typing, the program will suggest similar names. Click on a suggested name to select it."+
            "<li> You can use the <b>+</b> and <b>-</b> buttons in the upper left to adjust the font size."+
            "<li> Click the <b>X</b> button above this text to close this info panel."+
            "<li> You can use the keyboard to navigate, as well. The arrow keys will move focus between blood relatives, and the number keys will select a spouse."+
            "</ol>");
        var abouttext = "<b>About this tree</b><br><br>"+
            "This tree was compiled on "+data["config"]["created_date"]+".<br><br>"+
            "It contains "+data["structure_raw"].length+" individuals.<br><br>"+
            "The author of the tree is "+(data["config"]["author"] || displayName(data["structure"][data["config"]["initial_person"]]["name"]))+".<br><br>"+
            (data["config"]["about"] || "");
        var makeBirthdays = function(birthdays) {
            var div_container=document.createElement('div');
            div_container.className = "detaildatacontainer";

            var div_row = null;
            var div_surname = null;
            var div_names = null;
            var new_row = true;
            var previous_date = "";
            var handlePersonLink = function(evt) {
                view.setFocus(evt.currentTarget["data-person_id"], true);
            }
            var handle = function(date, id) {
                var aname = displayName(data["structure"][id].name);
                new_row = date != previous_date;

                if (new_row) {
                    div_row = document.createElement('div');
                    div_row.className="detaildata";

                    var div_surname = document.createElement('div');
                    div_surname.className = "detaildatadate";
                    div_surname.appendChild(document.createTextNode(date));

                    div_names = document.createElement('div');
                    div_names.className = "detaildatadata";

                    div_row.appendChild(div_surname);
                    div_row.appendChild(div_names);
                    div_container.appendChild(div_row);
                }

                var name = document.createElement('div');
                var a = document.createElement("a");
                previous_date = date;
                a.appendChild(document.createTextNode(aname));
                a["data-person_id"] = id;
                a.addEventListener("click", handlePersonLink);
                name.appendChild(a);
                div_names.appendChild(name);

            };

            for (var i=0; i<birthdays.length; i++)
            {
                var id = birthdays[i][0];
                var date = birthdays[i][1];
                handle(date, id);
            }
            return div_container;

        }

        var makeIndex = function() {
            var div_container=document.createElement('div');
            div_container.className = "detaildatacontainer";

            var div_row = null;
            var div_surname = null;
            var div_names = null;
            var new_row = true;
            var previous_name = "";
            var deferred = [];
            var handlePersonLink = function(evt) {
                view.setFocus(evt.currentTarget["data-person_id"], true);
            }
            var handle = function(i) {
                var new_surname = displaySurname(data["structure_raw"][i]["name"]);
                new_row = new_surname != previous_name;

                if (new_row) {
                    div_row = document.createElement('div');
                    div_row.className="detaildata";

                    var div_surname = document.createElement('div');
                    div_surname.className = "detaildatadate";
                    div_surname.appendChild(document.createTextNode(new_surname));

                    div_names = document.createElement('div');
                    div_names.className = "detaildatadata";

                    div_row.appendChild(div_surname);
                    div_row.appendChild(div_names);
                    div_container.appendChild(div_row);
                }

                var name = document.createElement('div');
                var a = document.createElement("a");
                var person_name = displayName(data["structure_raw"][i]["name"]);
                previous_name = new_surname;
                a.appendChild(document.createTextNode(person_name));
                a["data-person_id"] = data["structure_raw"][i]["id"];
                a.addEventListener("click", handlePersonLink);
                name.appendChild(a);
                div_names.appendChild(name);

            };

            for (var i=0; i<data["structure_raw"].length; i++)
            {
                var new_surname = displaySurname(data["structure_raw"][i]["name"]);
                if (new_surname == "UNKNOWN")
                    deferred.push(i);
                else
                    handle(i);
            }
            for (var i=0; i<deferred.length; i++)
            {
                handle(deferred[i]);
            }

            return div_container;

        }
        var container = document.createElement('div');
        var names = document.createElement('div'); names.className ='detaildatanames';
        container.appendChild(names);
        var name = document.createElement('div'); name.className='detaildataname';
        names.appendChild(name);
        name.appendChild(document.createTextNode('Help'));

        var tabs = document.createElement('div');
        tabs.className="detailtabselector";
        name.appendChild(tabs);

        var helptextdiv = document.createElement('div');
        helptextdiv.innerHTML = helptext;
        container.appendChild(helptextdiv);

        var buttons = [["About viewer", function() {helptextdiv.innerHTML = helptext;}],
                       ["About tree", function() {helptextdiv.innerHTML = abouttext;}],
                       ["Index", function() {makeEmpty(helptextdiv);
                                             helptextdiv.appendChild(makeIndex());}],
                       ["Birthdays", function() {makeEmpty(helptextdiv);
                                                 onDemandLoad(data, "birthdays", function(bd) {
                                                   helptextdiv.appendChild(makeBirthdays(bd)); });  }]
                        ];
        for (var i=0; i<buttons.length; i++) {
            var btn = document.createElement("span");
            btn.addEventListener("click", buttons[i][1]);
            btn.appendChild(document.createTextNode(buttons[i][0]));
            tabs.appendChild(btn);
        }

        showInfoWindow({"text":container});
    } 
    document.getElementById("closeinfowindow").onclick = function(evt) {
        fadeOut(document.getElementById("infowindow"),0.15);
    }
    document.getElementById("zoomin").onclick = function(evt) {
        view.zoomin();
    }
    document.getElementById("zoomout").onclick = function(evt) {
        view.zoomout();
    }

    var doSearch = function(text) {
        // TODO binary search?
        text = text.trim().toLowerCase();
        if (text == "") {
            displayError("Please enter a name into the search box, then press enter.", false);
            return;
        }
        for (var i=0; i<nameindex.length; i++)
            if (displayName(nameindex[i]["name"]).toLowerCase() == text) {
                view.setFocus(nameindex[i]["id"], true);
                return;
            }
        displayError("Sorry, \""+text+"\" does not exist in this tree. Please note that you must enter the name exactly.", false);
    };
    var searchtext = document.getElementById("searchtext");
    var searchlist = document.getElementById("searchlist");
    searchtext.addEventListener("focus",function(evt){
        evt.currentTarget.setSelectionRange(0, evt.currentTarget.value.length);
    }) 
    searchtext.addEventListener("keydown",function(evt) {
        if (evt.keyCode == 13)
            doSearch(searchtext.value);
    })
    searchtext.addEventListener("blur",function(evt){searchlist.style.display="none";})
    var searchResultEventListener = function(evt) {
        view.setFocus(evt.currentTarget["data-search_id"], true);
        searchtext.value = displayName(structure[evt.currentTarget["data-search_id"]]["name"]);
    };
    searchtext.addEventListener("input",function(evt) {
        while (searchlist.firstChild) {
            searchlist.removeChild(searchlist.firstChild);
        }        
        if (searchtext.value.length < 3)
            return;
        var words = searchtext.value.toLowerCase().split(" ");
        var somematch=false;
        for (var i=0; i<nameindex.length; i++)
        {
            var name = displayName(nameindex[i]["name"]).toLowerCase();
            var match = true;
            for (var j=0; j<words.length; j++)
            {
                if (words[j].length < 1)
                    continue;
                if (name.indexOf(words[j])<0)
                {
                    match = false;
                    break;
                }
            }
            if (match) {
                somematch=true;
                searchlist.style.display = "block";

                var el = document.createElement('div');
                el.className = "searchresult";
                var lifefrom = nameindex[i]["birth"][0];
                var lifeto = nameindex[i]["death"][0];
                var range="";
                if (lifefrom || lifeto)
                    range = " ("+lifefrom+"-"+lifeto+")";
                el.textContent=displayName(nameindex[i]["name"]) + range;
                el.addEventListener("mousedown",searchResultEventListener);
                el["data-search_id"]=nameindex[i]["id"];
                searchlist.appendChild(el);
            }
        }
        if (!somematch)
            searchlist.style.display="none";  
    })

};

var browserOkay = function() {
    var okay = true;
    if (!XMLHttpRequest) {
        debug("Missing XMLHttpRequest");
        okay = false;
    }
    else if (!(new XMLHttpRequest).addEventListener) {
        debug("Missing XMLHttpRequest.addEventListener");
        okay = false;
    }
    if (!Object.keys) {
        debug("Missing Object.keys");
        okay = false;
    }
    if (!document.createElement('canvas').getContext) {
        debug("Missing canvas");
        okay = false;
    }
    if (!JSON) {
        debug("Missing JSON");
        okay = false;
    }
    return okay;
};

var main = function() {
    var loadingwindow = document.getElementById("loadingwindow");
    if (!browserOkay()) {
        loadingwindow.style.display = "none";
        displayError("Your web browser is too old to use this program. Please upgrade to a modern browser and try again. I suggest <a href='https://www.google.com/chrome/browser/desktop/index.html'>Chrome</a> or <a href='https://www.mozilla.org/firefox/new/'>Firefox</a>.", true);
        return;
    }
    loadData(function(data) {
        fadeOut(loadingwindow);
        if (data == null) {
            displayError("Error loading required data from server. Try refreshing the page.", true);
            return;
        }
        var view = View(data);
        initSearch(data, view);
        initNarrative(data, view);

        var first_person = getHashString() || QueryString.person || data["config"]["initial_person"];
        view.init(first_person);

        if (QueryString.narr) {
            showNarrative(data, view, QueryString.narr);
        }

    });
};
