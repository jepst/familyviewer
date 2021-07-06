/*
Interactive family tree viewer
Written January 2016 by Jeff Epstein in Brno, Czech Republic
Released under GPL3
*/
/*jshint sub:true*/ /*jshint shadow:true*/
"use strict";

// Some formatting options
var verticalMargin = 45;
var horizontalMargin = 35;
var generationLimit = 3;
var nodeBorderMargin = 6;
var mouseClickRadius = 70;

// Global display modes
var print_mode = false;
var compact_mode = false;
var narrative_tree_style = null;
var aesthetic_table =
    {"bgcolor": {"m": "#a7cbca",
                 "f": "#dfa296",
                 "z": "#d3d3d3" }
 };
var aesthetic_table_bw =
    {"bgcolor": {"m": "#ffffff",
                 "f": "#ffffff",
                 "z": "#ffffff" }
 };

// Configure network access
var xhrTimeout = 20000;
var useObjectUrl = false;
var encryptedData = false;

var loadImage = function(src) {
    var img = new Image();
    img.src = src;
    return img;
};

var emptyImage = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

var loadLazyImage = function(src) {
    var img = new Image();
    img.src = emptyImage;
    img.setAttribute("data-lazy-src", src);
    return img;
};

var euclidean_distance = function(touches) {
    var x1 = touches[0].clientX;
    var y1 = touches[0].clientY;
    var x2 = touches[1].clientX;
    var y2 = touches[1].clientY;
    return euclidean_distance_impl(x1, y1, x2, y2);
};

var euclidean_distance_impl = function(x1, y1, x2, y2) {
    return Math.sqrt((y2-y1)*(y2-y1) + (x2-x1)*(x2-x1));    
};

var grayscalify = function(image) {
    //https://stackoverflow.com/questions/562135/how-do-you-convert-a-color-image-to-black-white-using-javascript
    var canvas=document.createElement("canvas");
    var ctx=canvas.getContext("2d");
 
    canvas.width= image.width;
    canvas.height= image.height;

    ctx.drawImage(image,0,0);
    var imageData=ctx.getImageData(0,0, image.width, image.height);

    for (var i=0;i<imageData.data.length;i+=4) {
        //var avg = (imageData.data[i]+imageData.data[i+1]+imageData.data[i+2])/3;
        var avg = imageData.data[i] * 0.2126 + imageData.data[i+1] * 0.7152 + imageData.data[i+2] * 0.0722;
        imageData.data[i] = avg;
        imageData.data[i+1] = avg;
        imageData.data[i+2] = avg;
    }
    ctx.putImageData(imageData, 0, 0, 0, 0, imageData.width, imageData.height);

    var newImg = document.createElement("img");
    newImg.src = canvas.toDataURL();
    return newImg;
};


var isvisible = function(obj) {
    // http://stackoverflow.com/questions/4795473/check-visibility-of-an-object-with-javascript
    return obj.offsetWidth > 0 && obj.offsetHeight > 0;
};

function ordinal_suffix_of(i) {
    // https://stackoverflow.com/questions/13627308/add-st-nd-rd-and-th-ordinal-suffix-to-a-number
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return i + "st";
    }
    if (j == 2 && k != 12) {
        return i + "nd";
    }
    if (j == 3 && k != 13) {
        return i + "rd";
    }
    return i + "th";
}

function multiplicative_of(i) {
    switch (i) {
        case 1:
            return "once";
        case 2:
            return "twice";
        case 3:
            return "thrice";
        default:
            return i+"-times";
    }
}

var addClass = function(node, className) {
    if (node.classList) {
        node.classList.add(className);
    } else {
        var classes = node.className.split(" ");
        classes.addonce(className);
        node.className = classes.join(" ");
    }
};

var hasClass = function(node, className) {
    if (node.classList)
        return node.classList.contains(className);
    else {
        var classes = node.className.split(" ");
        return classes.indexOf(className) >= 0;
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

if (typeof CanvasRenderingContext2D != 'undefined')
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      // from http://stackoverflow.com/questions/1255512/how-to-draw-a-rounded-rectangle-on-html-canvas
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      this.beginPath();
      this.moveTo(x+r, y);
      this.arcTo(x+w, y,   x+w, y+h, r);
      this.arcTo(x+w, y+h, x,   y+h, r);
      this.arcTo(x,   y+h, x,   y,   r);
      this.arcTo(x,   y,   x+w, y,   r);
      this.closePath();
      return this;
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

var resources = {};

var loadResources = function() {
    resources = {
        hiddenParentsImage: (loadImage('images/uparrow.png')),
        personImage: (loadImage('images/person.png')),
        hiddenParentsAndChildrenImage: (loadImage('images/doublearrow.png')),
        hiddenChildrenImage: (loadImage('images/downarrow.png')),
    };
};

var screenWidth = function() {
    return Math.min(window.outerWidth || window.innerWidth, window.innerWidth);
};
var screenHeight = function() {
    return Math.min(window.outerHeight || window.innerHeight, window.innerHeight);
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
    myloadingscreen.className = "loadingpanel infoflex";
    var msgdiv = document.createElement("div"); msgdiv.className='detailcontentcontainer';
    msgdiv.appendChild(document.createTextNode("Loading, please wait."));
    myloadingscreen.appendChild(msgdiv);
    showInfoWindow({"text": myloadingscreen});
    fetchStaticJson(addr, function(js) {
        if (js == null) {
            var myerrorscreen = document.createElement("div");
            myerrorscreen.className = "loadingpanel infoflex";
            var msgdiv = document.createElement("div"); msgdiv.className='detailcontentcontainer';
            msgdiv.appendChild(document.createTextNode("Detailed data isn't accessible right now. Make sure you are connected to the internet."));
            myerrorscreen.appendChild(msgdiv);
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
    var conditional_decrypt =
        encryptedData ? decrypt : function(x) {return x;};
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
                if (xhr.responseText.length < 2 || (xhr.responseText[0]!='[' && xhr.responseText[0]!='{')) {
                    callback(null);
                    return;
                }
                try {
                    ret = JSON.parse(conditional_decrypt(xhr.responseText));
                }
                catch (err) {
                }
                if (!called) {
                    called = true;
                    callback(ret);
                }
        }
    };
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

var dynamicLoadJavaScript = function(filename, callback) {
    var fileref=document.createElement('script');
    fileref.setAttribute("type","text/javascript");
    fileref.setAttribute("src", filename);
    fileref.setAttribute("async", false);
    fileref.addEventListener("load", callback);
    document.getElementsByTagName("head")[0].appendChild(fileref);
};

var loadData = function(callback) {
    var files1 = {
        "config": "data/config.json" };
    var files2 = {
        "structure_raw": "data/structure.json",
        "narratives": "data/narratives.json",
        "pictures": "data/pictures.json" };
    loadDataImpl(files1, function(ret) {
        if (ret!=null) {
            var nextBatch = function() { loadDataImpl(files2, function (ret2) {
                if (ret2!=null) {

                    var files={};

                    var retkeys = Object.keys(ret);
                    for (var i=0; i<retkeys.length; i++)
                        files[retkeys[i]] = ret[retkeys[i]];
                    var ret2keys = Object.keys(ret2);
                    for (var i=0; i<ret2keys.length; i++)
                        files[ret2keys[i]] = ret2[ret2keys[i]];

                    var structure = {};
                    for (var i=0; i<files["structure_raw"].length;i++)
                        structure[files["structure_raw"][i]["id"]]=files["structure_raw"][i];
                    files["structure"] = structure;
                    files["details"] = {};

                    callback(files);
                } else callback(null);
            }); };
            if (ret["config"] && ret["config"]["encrypted"]==true) {
                encryptedData = true;
                dynamicLoadJavaScript("../app/sjcl.js", function() {
                    dynamicLoadJavaScript("../app/login.js", nextBatch);
                });
            } else nextBatch();
        } else callback(null);
    });
};

var loadDataImpl = function(files, callback) {
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
                    if (errors == 0)
                        callback(files);
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

Array.prototype.remove = function(val) {
    var i = this.indexOf(val);
    if (i>=0)
        this.splice(i,1);
};

Array.prototype.addonce = function(val) {
    for (var i = 0, l=this.length; i < l; i++) {
        if (this[i] == val)
            return;
    }
    this.push(val);
};

Array.prototype.fillish = function(val) {
    for (var i=0; i<this.length; i++)
        this[i] =  val;
    return this;
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
    return personList.slice().sort(function(a,b){return -structure[a]["sex"].localeCompare(structure[b]["sex"]);});
};

var relationshipToParent = function(person, parent) {
    if (person["prel"] != undefined) {
        for (var i=0; i<person["prel"].length; i++) {
            var rel = person["prel"][i];
            if (rel[0] == parent)
                return " (" + rel[1] + ")";
        }
    }
    return "";
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
    };
    flattenTreeHelper(node);
    return all;
};

var findConnection = function(structure, fromid, toid) {
    var tagup = function(items, tag) {
        var newlist = [];
        for (var i=0; i<items.length; i++) {
            newlist.push([items[i], tag]);
        }
        return newlist;
    };
    var upConnections = function(person) {
        return sortByGender(structure, structure[person].parents);
    };
    var horizConnections = function(person) {
        return structure[person].spouses;
    };
    var downConnections = function(person) {
        var children = [];
        var spouses = horizConnections(person);

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
    };
    var seen = [];
    var queue = [{"c":[fromid], "p":["0"]}];
    while (!queue.equals([])) {
        var next = queue.shift();
        var lastvisited = next["c"].slice(-1);
        if (lastvisited == toid) {
            return next;
        }
        var connections = [].concat(tagup(downConnections(lastvisited),"C"),
                                    tagup(upConnections(lastvisited),"P"),
                                    tagup(horizConnections(lastvisited),"S"));

        for (var i = 0; i<connections.length; i++) {
            var connection=connections[i];
            if (seen.indexOf(connection[0]) < 0) {
                seen.push(connection[0]);
                var vv = {"c":next["c"].concat([connection[0]]),
                          "p":next["p"].concat([connection[1]])};
                queue.push(vv);
            }
        }
    }
    return null;
};

var translateConnection = function(structure, connection) {
    var s = "";
    var path = connection["p"];
    var genders = [];

    var gend = function(mfi, m, f, z) {
        return {"m":m,"f":f,"z":z}[mfi];
    };

    for (var i=0; i<connection["c"].length; i++) {
        genders.push(structure[connection["c"][i]]["sex"]);
    }

    //sibling simplification phase
    for (var i=1; i<path.length; i++) {
        if (path.slice(i,2+i).equals(["P","C"])) {
            path.splice(i,2,"SIB");
            genders.splice(i,1);
        }
    }

    //grandparent and grandchild simplification phase
    for (var i=1; i<path.length; i++) {
        if (path[i] == "C" || path[i]=="P") {
            var count = 1;
            var prefix="";
            while (count+i<path.length) {
                if (path[i+count]!=path[i])
                    break;
                count+=1;
                if (count>2)
                    prefix+="great-";
            }
            if (path[i+count]=="SIB" && path[i]=="P") {
                for (var j=i+count+1; j<path.length; j++)
                    if (path[j]!="C")
                        break;
                var cousins_up = count;
                var cousins_down = j-i-count-1;
                if (cousins_up >0 && cousins_down >0) {
                    var out = "the "+ ordinal_suffix_of(Math.min(cousins_up, cousins_down)) + " cousin";
                    if (cousins_up!=cousins_down)
                        out+=" "+multiplicative_of(Math.abs(cousins_up-cousins_down))+" removed";
                    path.splice(i,j-i,out+" of ");
                    genders.splice(i,j-i-1);
                    continue;
                }
            }
            if (count > 1) {
                if (count >4)
                    prefix = ordinal_suffix_of(count-2)+" great-";
                var relation = {"C":gend(genders[i-1],"father","mother","parent"),
                                "P":gend(genders[i-1],"son","daughter","child")}[path[i]]; 
                var newf = "the "+prefix+"grand"+relation+" of ";
                path.splice(i,count,newf);
                genders.splice(i,count-1);
                continue;
            }
        }
    }

    var rels = [
        [["S","C"], "the step-father of ", "the step-mother of ", "the step-parent of "],
        [["P","S"], "the step-son of ", "the step-daughter of ", "the step-child of "],
        [["C","S"], "the father-in-law of ", "the mother-in-law of ", "the parent-in-law of "],
        [["S", "SIB"], "the brother-in-law of ", "the sister-in-law of ", "the sibling-in-law of "],
        [["SIB", "C"], "the uncle of ", "the aunt of ", "the sibling of the parent of "],
        [["P", "SIB"], "the nephew of ", "the niece of ", "the child of the sibling of "]
    ];

    //additional relationship simplification phase
    for (var i=1; i<path.length; i++) {
        for (var rel=0; rel<rels.length; rel++) { 
            if (path.slice(i,2+i).equals(rels[rel][0])) {
                path.splice(i,2,gend(genders[i-1],rels[rel][1], rels[rel][2], rels[rel][3]));
                genders.splice(i,1);
                break;
            }
        }
    }

    // final translation phase
    var g="z";
    while (path.length > 0) {
        var step = path.shift();
        switch (step) {
            case "0":
                s+=displayName(structure[connection["c"][0]]["name"])+" is ";
                break;
            case "C":
                s+=gend(g,"the father of ","the mother of ","the parent of ");
                break;
            case "P":
                s+=gend(g,"the son of ", "the daughter of ", "the child of ");
                break;
            case "S":
                s+=gend(g, "the husband of ", "the wife of ", "the spouse of ");
                break;
            case "SIB":
                s+=gend(g,"the brother of ","the sister of ","the sibling of ");
                break;
            default:
                s+=step;
                break;
        }
        g = genders.shift() || "z";
    }
    return s+displayName(structure[connection["c"][connection["c"].length-1]]["name"]);
};


var Layout = function(layout_style, person, structure, view) {
/*Based on tree drawing code from here
    https://rachel53461.wordpress.com/2014/04/20/algorithm-for-drawing-trees/ */
    var getSiblings = function(person) {
        var generation = [];
        var parents = structure[person].parents;
        for (var i = 0; i < parents.length; i++) {
            var parentid = parents[i];
            for (var j = 0; j < structure[parentid].children.length; j++) {
                var child = structure[parentid].children[j];
                if (structure[child].parents.slice().sort().equals(structure[person].parents.slice().sort()))
                    generation.addonce(child);
            }
        }
        generation.addonce(person);
        return generation;
    };
    var getSpouses = function(person) {
        // TODO sort m-f
        return structure[person].spouses;
    };
    var getParents = function(person) {        
         return sortByGender(structure, structure[person].parents);
    };
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
    };
    var mappedNodes = {};
    var makeNodePedigree = function(person, generation) {
        var newnode = Node(structure[person]);
        newnode.generation=generation;
        var parents = getParents(person);
        for (var i=0; i<parents.length; i++) {
            if (parents[i] in mappedNodes)
                continue;
            var aparent = makeNodePedigree(parents[i], generation - 1);
            aparent.descendents_down.addonce(newnode);
            newnode.ascendents_down.addonce(aparent);
        }
        mappedNodes[person] = newnode;
        nodeCount++;
        return newnode;
    };
    var makeNodeConnections = function(person, target) {
        var connection = findConnection(structure, person, target);
        var visited = [];
        if (connection == null) {
            displayError("I can't find out how to connect these people", true);
            return null;
        }

        var relationship=translateConnection(structure, connection);
        displayNotification(relationship);

        connection = connection["c"];
        var topid = connection.shift();
        var top;
        var interiorNodes={};

        var topspouses = getSpouses(topid);

        top = Node(structure[topid]);
        mappedNodes[topid]=top;
        interiorNodes[topid] = top;

        top.generation = 0;
        top.ascendents_down=[];
        top.descendents_down=[];
        var lastid = topid;
        var last = top;
        var lastlast = null;
        while (!connection.equals([])) {
            var nextid = connection.shift();
            visited.push(nextid);
            var spouses = getSpouses(lastid);
            var children = getChildren(lastid);
            var parents = getParents(lastid);
            var nextspouses = getSpouses(nextid);
            var nextspouses2 = [];
/*            for (var i=0; i<nextspouses.length; i++) {
                var ns = nextspouses[i];
                if (connection.length>0) {
                    var nextnext = connection[0];
                    var rels = [].concat(getChildren(ns),getParents(ns));
                    if ((rels.indexOf(lastid) >= 0 &&
                        rels.indexOf(nextnext) >= 0) ||
                        nextnext == ns)
                            nextspouses2.push(ns);
                }
            }*/
            var next;
            
            next = Node(structure[nextid]);
            mappedNodes[nextid]=next;
            interiorNodes[nextid]=next;

            next.ascendents_down=[];
            next.descendents_down=[];
            if (spouses.indexOf(nextid) >= 0) {
                var allspouses = last.getIds().concat([nextid]);
                var tempnext = nextid;
                while (connection.length > 0 && getSpouses(connection[0]).indexOf(tempnext)>=0 ) {
                    tempnext = connection.shift();
                    allspouses.push(tempnext);
                }
                var allspouses_obj=[];
                for (var i=0; i<allspouses.length; i++) {
                    var spouse=allspouses[i];
                    var obj = Node(structure[spouse]);
                    interiorNodes[spouse] = obj;
                    obj.generation=last.generation;
                    allspouses_obj.push(obj);
                    next = obj;
                }
                var newnext = NodeGroup(allspouses_obj);
                newnext.generation = last.generation;
                for (var i=0; i<allspouses.length; i++)
                {
                    mappedNodes[allspouses[i]] = newnext;
                }
                if (lastlast) {
                    var obj = mappedNodes[lastlast.getId()];
                    if (lastlast.ascendents_down.indexOf(last)>=0) {
                        obj.ascendents_down.remove(last);
                        obj.ascendents_down.addonce(newnext);
                        lastlast.ascendents_down.remove(last);
                        lastlast.ascendents_down.addonce(newnext);
                    }
                    if (lastlast.descendents_down.indexOf(last)>=0) {
                        obj.descendents_down.remove(last);
                        obj.descendents_down.addonce(newnext);
                        lastlast.descendents_down.remove(last);
                        lastlast.descendents_down.addonce(newnext);
                    }
                }
                newnext.descendents_down = last.descendents_down.slice();
                newnext.ascendents_down = last.ascendents_down.slice();
                nextid = next.getId();
            } else if (children.indexOf(nextid) >= 0) {
                if (mappedNodes[last.getId()] != interiorNodes[last.getId()]) {
                    mappedNodes[last.getId()].descendents_down.addonce(next);
                    next.ascendents_down.addonce(mappedNodes[last.getId()]);
                }
                last.descendents_down.addonce(next);
                next.ascendents_down.addonce(last);
                next.generation = last.generation+1;
            } else if (parents.indexOf(nextid) >= 0) {
                if (mappedNodes[last.getId()] != last) {
                    mappedNodes[last.getId()].ascendents_down.addonce(next);
                    next.descendents_down.addonce(mappedNodes[last.getId()]);
                }
                last.ascendents_down.addonce(next);
                next.descendents_down.addonce(last);
                next.generation = last.generation-1;
            } else {
                displayError("Bad connection", true);
                return null;
            }
            if (next.generation < top.generation) {
                top = next;
                topid = nextid;
            }
            lastlast = last;
            lastid = nextid;
            last = next;
        }
    };
    var nodeCount = 0;
    var makeNode = function(person, generation, generation_limit) {
        if (person in mappedNodes)
            return mappedNodes[person];
        var newNode = null;
        if (getSpouses(person).length == 0 || (render_opt("omit_spouses")&&generation!=0)) {
            newNode = Node(structure[person]);
            mappedNodes[person] = newNode;
        } else {
            var plist = [person].concat(getSpouses(person));
            newNode = NodeGroup(jmap(function(p){return Node(structure[p]);}, plist));
            for (var i=0; i<plist.length; i++)
                mappedNodes[plist[i]] = newNode;
        }
        newNode.generation = generation;
        if (getParents(person).length == 0)
            newNode.ascendents_down = [];
        else {
            var padres = getParents(person);
            newNode.ascendents_down = [];
            for (var i=0; i<padres.length; i++)
                if (padres[i] in mappedNodes)
                    newNode.ascendents_down.addonce(makeNode(padres[i], generation -1,generation_limit ));
        }
        
        var childs = getChildren(person);
        if (childs.length > 0) {
            if (Math.abs(generation) < generation_limit) {
                newNode.descendents_down = [];
                for (var i=0; i<childs.length; i++)  {
                    var temp = makeNode(childs[i],generation+1, generation_limit);
                    if (temp.ascendents_down.indexOf(newNode)<0)
                        continue;
                    newNode.descendents_down.push(temp);
                }
            }
        }
        nodeCount++;
        return newNode;
    };
    var verticalSpacing = function(view, node_list)
    {
        var maxheights = {};
        var localverticalMargin = verticalMargin;
        if (compact_mode)
            localverticalMargin *= 0.75;
        for (var i = 0; i<node_list.length; i++)
        {
            var dims = node_list[i].calcDimensions(view);
            var w = dims[0]; var h = dims[1];
            maxheights[node_list[i].generation] = Math.max(maxheights[node_list[i].generation] || 0, h);
        }
        var sumHeights = {};
        sumHeights[0] = 0;
        for (var i = 1; i in maxheights; i++)
            sumHeights[i] = sumHeights[i-1] + maxheights[i-1] + localverticalMargin;
        for (var i = -1; i in maxheights; i--)
            sumHeights[i] = sumHeights[i+1] - maxheights[i] - localverticalMargin;
        for (var i = 0; i<node_list.length; i++)
        {
            var pos = node_list[i].getPos();
            var x = pos[0]; var y = pos[1];
            node_list[i].setPos(x,sumHeights[node_list[i].generation]);
        }
    };
    var helperIsNodeLeaf = function(node) {
        return node.descendents_down.length == 0;
    };
    var helperIsNodeLeftMost = function(node) {
        if (node.ascendents_down.length == 0)
            return true;
        return node.getIds().indexOf(node.ascendents_down[0].descendents_down[0].getId()) >= 0;
    };
    var helperGetPreviousSibling = function(node) {
        if (node.ascendents_down.length == 0)
            debug("No ascendents");
        var options = node.ascendents_down[0].descendents_down;
        for (var i=0; i<options.length; i++)
            if (node.getIds().indexOf(options[i].getId())>=0)
                return options[i-1];
        debug("inconsistent tree");
        return null;
    };
    var getLeftContour = function(node) {
        var getLeftContourHelper = function(node, modSum, values) {
            if (node.generation in values)
                values[node.generation] = Math.min(values[node.generation], node.getX() + modSum);
            else
                values[node.generation] = node.getX() + modSum;

            modSum += node.mod;
            for (var i=0; i<node.descendents_down.length; i++)
                getLeftContourHelper(node.descendents_down[i], modSum, values);
        };
        var values = {};
        getLeftContourHelper(node, 0, values);
        return values;
    };
    var getRightContour = function(node) {
        var getRightContourHelper = function(node, modSum, values) {
            if (node.generation in values)
                values[node.generation] = Math.max(values[node.generation], node.getX() + node.getWidth() + modSum);
            else
                values[node.generation] = node.getX() + node.getWidth() + modSum;

            modSum += node.mod;
            for (var i=0; i<node.descendents_down.length; i++)
                getRightContourHelper(node.descendents_down[i], modSum, values);
        };
        var values = {};
        getRightContourHelper(node, 0, values);

        return values;
    };
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
    };
    var checkForConflicts = function(node)
    {
        var treeDistance = 30; // minimum distance between cousin nodes
        var shift = 0;
        var nodeCounter = getLeftContour(node);
        if (node.ascendents_down.length == 0)
            return;

        var lefterNodes=[];
        for (var j=0; j<node.ascendents_down.length; j++) {
            for (var i=0; i<node.ascendents_down[j].descendents_down.length &&
                node.ascendents_down[j].descendents_down[i] != node; i++)
                lefterNodes.push(node.ascendents_down[j].descendents_down[i]);    
            if (node.ascendents_down[j].descendents_down.indexOf(node)>=0)
                break;
        }
        for (var j=0; j<node.descendents_down.length; j++) {
            for (var i=0; i<node.descendents_down[j].ascendents_down.length &&
                node.descendents_down[j].ascendents_down[i] != node; i++)
                lefterNodes.push(node.descendents_down[j].ascendents_down[i]);     
            if (node.descendents_down[j].ascendents_down.indexOf(node)>=0)
                break;
        }


        var startinglevel = Math.min.apply(null,jmap(parseInt, Object.keys(nodeCounter)));
        var endinglevel = Math.max.apply(null,jmap(parseInt, Object.keys(nodeCounter)));
        for (var i=0; i<lefterNodes.length; i++) {
            var sibling = lefterNodes[i];
            var siblingContour = getRightContour(sibling);

            for (var level = startinglevel+1;level<=endinglevel; level ++) {
                if (!(level in siblingContour && level in nodeCounter))
                    continue;
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
    };
    var invertedTreeAdjust = function(nodes) {
        var generations = [];
        for (var i=0; i<nodes.length; i++)
            generations.push(nodes[i].generation);
        var mingen = Math.min.apply(null,generations);
        var maxgen = Math.max.apply(null,generations);
        for (var g = mingen; g<=maxgen; g++) {
            for (var i=0; i<nodes.length; i++) {
                if (nodes[i].dummy)
                    continue;
                if (nodes[i].generation == g) {
                    var node = nodes[i];
                    if (node.ascendents_down.length>1) {
                        var l = node.ascendents_down[0].getX();
                        var r = node.ascendents_down[node.ascendents_down.length-1].getX() + node.ascendents_down[node.ascendents_down.length-1].getWidth();
                        var dist = (r-l)/2 - node.getWidth()/2;
                        node.setX(l+dist);
                    }
                }
            }
        }
    };
    var calculateInitialX = function(node)
    {
        if (node.calculatedInitialX)
            return;
        var localhorizontalMargin = horizontalMargin;
        if (compact_mode)
            localhorizontalMargin /= 2;
        node.calculatedInitialX = true;
        for (var i=0; i<node.descendents_down.length; i++)
            calculateInitialX(node.descendents_down[i]);
        if (helperIsNodeLeaf(node)) {
            if (helperIsNodeLeftMost(node))
                node.setX(0);
            else
                node.setX(helperGetPreviousSibling(node).getX() + helperGetPreviousSibling(node).getWidth() + localhorizontalMargin );
        } else {
            var left = node.descendents_down[0].getX();
            var lastchild = node.descendents_down[node.descendents_down.length-1];
            var right = lastchild.getX() + lastchild.getWidth();
            var mid = (left + right) / 2;
            if (helperIsNodeLeftMost(node))
                node.setX(mid - node.getWidth()/2);
                else {
                var prev = helperGetPreviousSibling(node);
                node.setX(prev.getX() + prev.getWidth() + localhorizontalMargin);
                node.mod = node.getX() - mid + node.getWidth()/2;
                }
        }
        if (node.descendents_down.length > 0) // TODO ONLY IF descendants aren't already checked
            checkForConflicts(node);
    };
    var addParents = function(indv) {
        var node = mappedNodes[indv];
        if (!node)
            return;
        var parents = structure[indv]["parents"];
        var realparents = [];
        for (var i=0; i<parents.length; i++)
            if (!(parents[i] in mappedNodes))
                realparents.push(parents[i]);
        var newnode=null;
        if (realparents.length == 1) {
            newnode = Node(structure[realparents[0]]);
        }
        else if (realparents.length > 1) {
            newnode = NodeGroup(jmap(function(p){return Node(structure[p]);}, realparents));
        }
        if (newnode == null)
            return;
        for (var i=0; i<realparents.length; i++)
            mappedNodes[realparents[i]] = newnode;
        newnode.generation=node.generation-1;
        newnode.descendents_down.addonce(node);
        node.ascendents_down.addonce(newnode);

        var node_submembers = node.getMembers();
        var parents_submembers = newnode.getMembers();
        for (var i=0; i<node_submembers.length; i++)
            for (var j=0; j<parents_submembers.length; j++) {
                var node_submember = node_submembers[i];
                var parents_submember = parents_submembers[j];
                if (node_submember.getId() == mappedNodes[node_submember.getId()].getId())
                    continue;
       
                if (structure[parents_submember.getId()]["children"].indexOf(node_submember.getId())>=0) {
                    parents_submember.descendents_down.addonce(node_submember);
                    node_submember.ascendents_down.addonce(parents_submember);
                }
            }
    };
    var treeExtents = null;
    var render_opt = function(opt) {
        if (layout_style["render_opts"])
            return layout_style["render_opts"].indexOf(opt)>=0;
        return false;
    };
    var calculateFinalPositions = function(node, modSum) {
        if (node.setFinalPositions)
            return;
        node.doSetFinalPositions();
        node.setX(node.getX() + modSum);
        modSum += node.mod;
        for (var i=0; i<node.descendents_down.length; i++) {
            calculateFinalPositions(node.descendents_down[i], modSum);
        }
        if (treeExtents == null)
            treeExtents = [node.getX(), node.getY(), node.getX()+node.getWidth(), node.getY()+node.getHeight()];
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
    };
    var doAddParents = function() {
        if (render_opt("addparents")) {
            var spouseGroup = mappedNodes[person].getIds();
            for (var i=0; i<spouseGroup.length; i++) {
                addParents(spouseGroup[i]);
                break;
            }
        }
    };
    switch (layout_style["style"]) {
        case "subtree":
            layout_style["generation_limit"] = layout_style["generation_limit"] || 100;
            makeNode(person, 0, layout_style["generation_limit"] || generationLimit);
            doAddParents();
            displayNotification(displayName(structure[person]["name"])+" has "+(nodeCount-1).toString()+" descendants");
            break;
        case "standard":
            makeNode(person, 0, layout_style["generation_limit"] || generationLimit);
            doAddParents();
            break;
        case "connection":
            makeNodeConnections(person, layout_style["target"]);
            break;
        case "pedigree":
            makeNodePedigree(layout_style["focus"] || person,0);
            displayNotification(displayName(structure[person]["name"])+" has "+(nodeCount-1).toString()+" known ancestors");
            break;
        default:
            debug("invalid layout_style");
    }
    var toplevel = [];
    var k = Object.keys(mappedNodes);
    for (var i=0; i<k.length; i++) {
        mappedNodes[k[i]].finalizeRelationships(structure);
        if (mappedNodes[k[i]].ascendents_down.length == 0)
            toplevel.push(mappedNodes[k[i]]);
    }
    var toplevelnode = DummyNode();
    for (var i=0; i<toplevel.length; i++) {
        toplevelnode.descendents_down.push(toplevel[i]);
        toplevel[i].ascendents_down.push(toplevelnode);
    }

    return {
        recalcNodeText: function() {
            var k = Object.keys(mappedNodes);
            for (var i=0; i<k.length; i++)
                mappedNodes[k[i]].recalcNodeText();        
        },
        flushDimensionCache: function() {
            toplevelnode.flushDimensionCache();
            treeExtents = null;
            var k = Object.keys(mappedNodes);
            for (var i=0; i<k.length; i++)
                mappedNodes[k[i]].flushDimensionCache();
        },
        getTreeExtents: function() {
            return treeExtents;
        },
        lookupNodeById: function(personid) {
            if (personid in mappedNodes)
                return mappedNodes[personid];
            else
                return null;
        },
        allNodes: function() {
            var k = Object.keys(mappedNodes);
            var all = [];
            for (var i=0; i<k.length; i++)
                all.push(mappedNodes[k[i]]);
            return all;
        },
        position : function(view) {
            var allnodes = this.allNodes();
            verticalSpacing(view, allnodes);
            calculateInitialX(toplevelnode);
            calculateFinalPositions(toplevelnode, 0);
            if (layout_style["style"] == "pedigree")
                invertedTreeAdjust(allnodes);
        }
    };
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
    };
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
    };
};


var baseFont = TextAttr(13, "sans-serif", "normal", "#000000");
var detailFont = TextAttr(10, "sans-serif", "normal", "#707070");
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

                var textwidth;
                // technique 0: no text, no width
                if (elem.length==0)
                    textwidth=0;
                else {
                    // technique 1: just ask the canvas
                    textwidth = _view.context.measureText(elem).width;
                    // technique 2: slower, sometimes broken
                    if (textwidth==0)
                        textwidth=textWidthHack(elem, _view);
                }

                x += textwidth;
                maxwidth = Math.max(maxwidth, x-_x);
                linemaxheight = Math.max(linemaxheight, lastFont.getheight());
            }
        } else { // it is a TextAttr
            lastFont = elem;
            elem.apply(_view);
        }
    }
    return [maxwidth, (y + linemaxheight) - _y];
};

var textWidthHackCache = {};
var textWidthHack = function(text, view) {
    // canvas.context.measureText(elem).width sometimes returns 0 if the browser
    // blocks fingerprinting, so we need another way to calculate text width
    // This problem originally arose in 2020 with the Brave mobile browser.

    var key = view.context.font+"//"+text;
    if (typeof textWidthHackCache[key] == "undefined") {
        var thing = document.getElementById('dumbhack');
        if (thing==undefined) {
            var container = document.getElementById('widgets');
            thing = document.createElement('div');
            thing.id = 'dumbhack';
            thing.style["visibility"] = "hidden";
            thing.style["position"] = "absolute";
            container.appendChild(thing);
        }

        thing.style["font"] = view.context.font;
        thing.appendChild(document.createTextNode(text));
        var width = thing.offsetWidth;
        while (thing.firstChild)
            thing.removeChild(thing.firstChild);
        textWidthHackCache[key] = width;
        return width;
    } else {
        return textWidthHackCache[key];
    }
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



var drawParentalLine = function(view, parent, child, nth, maxnth) {
    var tmp = child.getParentConnectorPoint(parent);
    var childx = tmp[0]; var childy = tmp[1];
    tmp = parent.getChildConnectorPoint();
    var parentx = tmp[0]; var parenty = tmp[1];

    childx+=view.scrollx; childy+=view.scrolly;
    parentx+=view.scrollx; parenty+=view.scrolly;

    view.context.strokeStyle = "#373737";
    view.context.lineWidth = 1;
    view.context.beginPath();
    view.context.moveTo(childx,childy);
    var localverticalMargin = verticalMargin;
    if (compact_mode)
        localverticalMargin *= 0.75;

    var internodespace = localverticalMargin - nodeBorderMargin;

    var horizy = (childy-internodespace/2);
    if (maxnth >= 2)
        horizy = (childy-internodespace) + (nth+1)*(internodespace/(maxnth+1));
        // nth = Math.pow(-1,nth&1) * (nth>>1);

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
    };
    var cached_dimensions = null;
    var cached_horizLineMappings = null;
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
                    var childid = this.descendents_down[j].getId();
                    var parentid = _nodes[i].getId();
                    if (structure[parentid].children.indexOf(childid)>=0)
                        _nodes[i].descendents_down.addonce(this.descendents_down[j]);


                }
            }
        },
        getChildConnectorPoint: function() {
            debug("This function doesn't exist");
        },
        getParentConnectorPoint: function(parent) {
            for (var i=0; i<_nodes.length; i++)
                if (_nodes[i].ascendents_down.indexOf(parent) >= 0) {
                    return _nodes[i].getParentConnectorPoint(parent);

                }
            return _nodes[0].getParentConnectorPoint(parent);
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
        doSetFinalPositions: function() {
            this.setFinalPositions = true;
            for (var i=0; i<_nodes.length; i++) {
                _nodes[i].doSetFinalPositions();
            }
        },
        recalcNodeText : function() {
            for (var i=0; i<_nodes.length; i++) {
                _nodes[i].recalcNodeText();
            }            
        },
        flushDimensionCache : function() {
            this.calculatedInitialX = false;
            this.setFinalPositions = false;
            this.mod = 0;
            cached_dimensions = null;
            cached_horizLineMappings = null;
            minHeight = 0;
            for (var i=0; i<_nodes.length; i++) {
                _nodes[i].flushDimensionCache();
            }
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
        calcParentalLineHorizontalness : function() {
            if (cached_horizLineMappings != null)
                return cached_horizLineMappings;
            // Still not quite right: unowned children (those connected to the 0th spouse)
            // are not accounted for. Because we don't know which children are unowned
            // until we finish drawing them. To rectify that, we'd have to two two passes:
            // figure out exactly which children are drawn from each spouse, then calc
            // the line heights, then draw them.
            var STARTING_POINT=1;
            var horizLineMappings = Array(_nodes.length).fillish(0);
            var ranges = [];
            for (var i=0; i<_nodes.length; i++)
                ranges.push(_nodes[i].parentalLineRange());
            for (var i=STARTING_POINT; i<horizLineMappings.length; i++) {
                if (ranges[i].length==0)
                    continue;
                for (var j=STARTING_POINT; j<i; j++) {
                    if (ranges[j].length==0)
                        continue;

                    if (ranges[i][0] <= ranges[j][1]) {
                        if (ranges[i][0] <= _nodes[j].getChildConnectorPoint()[0])
                            horizLineMappings[i] = Math.max(horizLineMappings[i], horizLineMappings[j]+1);
                        else
                            horizLineMappings[i] = Math.min(horizLineMappings[i], horizLineMappings[j]-1);
                    }
                }
            }
            var minhorizma = Math.min.apply(null, horizLineMappings);
            for (var i=0; i<horizLineMappings.length; i++)
                horizLineMappings[i]-=minhorizma;
            cached_horizLineMappings = horizLineMappings;
            return cached_horizLineMappings;
        },
        drawLines : function(view) {
            var horizLineMappings = this.calcParentalLineHorizontalness();
            var maxhorizma = Math.max.apply(null, horizLineMappings)+1;

            var already_drawn=[];

            for (var i=1; i<_nodes.length; i++) {
                var res =  _nodes[i].drawLines(view, [], horizLineMappings[i], maxhorizma);
                already_drawn = already_drawn.concat(res);
            }

            _nodes[0].drawLines(view, already_drawn, horizLineMappings[0], maxhorizma);
        }

    };
};

var Node = function(_person) {

    var text = makeNodeText(_person);
    var text_dimensions = null;

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
        getParentConnectorPoint: function(parent)
        {
            var ax = x + this.getWidth() / 2;
            var ay = y;
            return [ax,ay-nodeBorderMargin];
        },
        getId : function()
        {
            return _person.id;
        },
        getMembers : function() {
            return [this];
        },
        getIds : function()
        {
            return [_person.id];
        },
        getText : function ()
        {
            return text;
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
        recalcNodeText : function() {
            text = makeNodeText(_person);
        },
        flushDimensionCache : function() {
            text_dimensions = null;
            this.calculatedInitialX = false;
            this.setFinalPositions = false;
            this.mod = 0;
        },
        doSetFinalPositions : function() {
            this.setFinalPositions = true;
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
                var BOXCORNERS = 8;
                var tmp = this.getPos();
                var x = tmp[0];
                var y = tmp[1];
                x+=view.scrollx;
                y+=view.scrolly;
                var tmp = this.getRect(view);var myx=tmp[0];var myy=tmp[1];var w=tmp[2]; var h=tmp[3];

                 //don't draw off screen, unless we're in print mode
                if (!print_mode)
                    if (x > view.canvas.width || x+w<0 ||
                        y > view.canvas.height || y+h<0)
                        return;

                view.context.fillStyle = aesthetic_table["bgcolor"][_person["sex"] || "z"];
                view.context.roundRect(myx,myy,w,h,BOXCORNERS).fill();
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
                    view.context.roundRect(myx+2,myy+2,w-4,h-4, BOXCORNERS).stroke();    
                }
                else {
                    view.context.lineWidth = 1;
                    view.context.strokeStyle = "#000000";
                    view.context.roundRect(myx,myy,w,h, BOXCORNERS).stroke();    
                }


        },
        parentalLineRange : function() {
            if (this.descendents_down.length == 0)
                return [];
            var range = [this.getChildConnectorPoint()[0]];
            for (var i=0; i<this.descendents_down.length; i++)
                range.push(this.descendents_down[i].getParentConnectorPoint(this)[0]);
            return [Math.min.apply(null,range), Math.max.apply(null,range)];
        },
        drawLines : function(view, exclude, nth, maxnth) {
            exclude = exclude || [];
            if (this.descendents_down.length == 0)
                return [];
            for (var i=0; i<this.descendents_down.length; i++)
            {
                var child = this.descendents_down[i];
                if (exclude.indexOf(child)>=0)
                    continue;
                drawParentalLine(view, this, child, nth, maxnth);
            }
            return this.descendents_down;
        },
    };
};

var DummyNode = function() {

    return {

        ascendents_up : [],
        descendents_up : [],

        ascendents_down : [],
        descendents_down : [],
        generation : 0,
        mod : 0,
        dummy: true,
        hidden_parents: false,
        hidden_children: false,
        focused:false,
        group:null,
        doSetFinalPositions : function() {
            this.setFinalPositions = true;
        },
        flushDimensionCache : function() {
            this.calculatedInitialX = false;
            this.setFinalPositions = false;
            this.mod = 0;
        },
        getInteriorNodeById: function(nodeid) {
            return this;
        },
        finalizeRelationships: function(structure)
        {
        },
        getChildConnectorPoint: function()
        {
            debug("There is no child conector");
            return [0,0];
        },
        getParentConnectorPoint: function(parent)
        {
            debug("There is no parent conector");
            return [0,0];
        },
        getId : function()
        {

            return null;
        },
        getIds : function()
        {
            return [null];
        },
        getText : function ()
        {
            return "DummyNode";
        },
        getX: function ()
        {
            return 0;
        },
        getY: function()
        {
            return 0;
        },
        setX: function(a)
        {
        },
        setY: function(a)
        {
        },
        getPos : function()
        {
            return [0,0];
        },
        setPos : function(ax,ay)
        {
        },
        toString : function() {
            return "DummyNode";
        },
        getWidth : function()
        {
            return 0;
        },
        getHeight : function()
        {
            return 0;
        },
        calcDimensions : function(view)
        {
            return [0,0];
        },
        getRect : function(view)
        {
            return [0,
                    0,
                    0,
                    0];
        },
        hitTest : function(view,x,y) {
            return [false];
        },
        draw : function(view) {
        },
        drawLines : function(view) {
        },
    };
};

var displayNotification = function(text) {
    var msg = document.getElementById("notification");
    msg.innerHTML=text;
    fadeIn(msg,0.15,"inline-block");
    setTimeout(function(){ fadeOut(msg); }, 10000);
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
    var dir = data["config"]["pictures_prefix"] || "pictures/";
    return dir+prefix + picid + ".jpg";
};

var closePicViewer = function() {
    var picviewer = document.getElementById("picviewer");
    var oldstate = picviewer.style.display;
    picviewer.style.display="none";   
    picviewer.blur();
    return (oldstate != "none" && oldstate != undefined);
};

var makeThumbnailPane = function(view, data, picids, filter, limit) {
    var resizetimer=null;
    var doPicViewer = function(piclist, picindex, picpage) {
        var caption = data["pictures"]["picture_table"][piclist[picindex]]["caption"];
        var dim = data["pictures"]["picture_table"][piclist[picindex]]["dim"].split("x");
        var peers = data["pictures"]["picture_table"][piclist[picindex]]["people"];
        var tags = data["pictures"]["picture_table"][piclist[picindex]]["tag"];
        var multipage = data["pictures"]["picture_table"][piclist[picindex]]["multipage"];
        var picfile=piclist[picindex];
        if (typeof picpage=="undefined")
            picpage=0;
        if (multipage && picpage>0) {
            picfile = multipage[picpage-1];
            dim=data["pictures"]["picture_table"][picfile]["dim"].split("x");
        }
        for (var i=0; i<dim.length; i++)
            dim[i]=parseInt(dim[i]);
        var picviewer = document.getElementById("picviewer");
        makeEmpty(picviewer);

        var bg = document.createElement('div');
        bg.className = 'pvBackground';
        picviewer.appendChild(bg);

        var selectPic = function(newindex, direction, newpage) {
            var newindex = newindex % piclist.length;
            if (newindex<0)
                newindex = piclist.length+newindex;
            var steps=13;
            (function repeater(){
                steps-=1;
                if (steps) {
                    if (direction)
                        pic.style.left=(parseInt(pic.style.left)-20)+"px";
                    else
                        pic.style.left=(parseInt(pic.style.left)+20)+"px";
                    pic.style.top=(parseInt(pic.style.top)+2)+"px";
                    requestFrame(repeater);
                } else {
                    doPicViewer(piclist, newindex, newpage);
                }
            })();
        }; 

        var previousPic = function() {
            if (multipage) {
                if (picpage==0)
                    selectPic(picindex-1,true);
                else
                    selectPic(picindex,true,picpage-1);
            } else
                selectPic(picindex-1,true);
        };
        var nextPic = function() {
            if (multipage) {
                if (picpage<multipage.length)
                    selectPic(picindex,false,picpage+1);
                else
                    selectPic(picindex+1,false);    
            } else
                selectPic(picindex+1,false);
        };
        picviewer.onkeydown=function(evt){
            if (evt.ctrlKey || evt.altKey)
                return;
            var handled=false;
            switch (evt.keyCode) {
                case 38: case 87: //up
                    pos[1]+=50;
                    fitPicInScreen();
                    handled=true;
                    break;
                case 40: case 83: //down
                    pos[1]-=50;
                    fitPicInScreen();
                    handled=true;
                    break;
                case 37: case 65: //left
                    previousPic();
                    handled=true;
                    break;
                case 39: case 68: //right
                    nextPic();
                    handled=true;
                    break;
                case 27: //esc
                    closePicViewer();
                    handled=true;
                    break;
                case 173: // minus
                case 189: // chrome minus
                case 108: // alt minus
                    if (slider) {
                        var newval=(parseInt(slider.value,10)-10);
                        fitPicInScreen(newval/100, true);
                    }
                    handled=true;
                    break;
                case 61: // plus
                case 187: // chrome plus
                case 107: // alt plus
                    if (slider) {
                        var newval=(parseInt(slider.value,10)+10);
                        fitPicInScreen(newval/100, true);
                    }
                    handled=true;
                    break;
            }
            if (handled) {
                evt.stopPropagation();
                return false;
            }            
        };

        window.onresize = function() {
            if (isvisible(picviewer)&&resizetimer==null) {
                resizetimer=setTimeout(function() {
                    resizetimer=null;
                    doPicViewer(piclist,picindex);
                },150);
            }
        };

        var pic = document.createElement('div');
        pic.style.position="absolute";
        var picwidth = dim[0];
        var picheight = dim[1];
        var dim_orig =dim.slice();
        var totalwidth = screenWidth();
        var totalheight = screenHeight();
        var carouselheight = 100;
        var targetwidth = totalwidth * 0.9;
        var targetheight = totalheight * 0.9 - carouselheight;
        var wscale = 1; var hscale = 1;
        if (picwidth > targetwidth)
            wscale = targetwidth / picwidth;
        if (picheight > targetheight)
            hscale = targetheight / picheight;
        var scale = Math.min(hscale, wscale);
        var MAXMULT = 1.75;
        var tag_isdocument = tags == "ref" || tags == "cen";
        if (tag_isdocument) {
            picwidth = Math.min(dim[0],targetwidth);
            picheight = Math.min(dim[1],targetheight);

            // Very large documents may be scaled
            // to avoid excessive scrolling:
            // no document may be more than MAXMULT times
            // wider than the picture viewport
            if (dim[0] > MAXMULT*picwidth) {
                wscale = (MAXMULT*picwidth)/dim[0];
                dim[0]*=wscale; dim[1]*=wscale;
            }
        } else {
            picwidth *= scale;
            picheight *= scale;
        }
        var initialScale = dim[0]/dim_orig[0];
        pic.style.background="#000000";
        pic.style.border = "2px solid black";
        pic.style.left = ((totalwidth - picwidth) / 2)+"px";
        pic.style.top = (((totalheight - picheight - carouselheight) / 2)) +"px";
        var img = loadImage(getPicturesFilename(data, picfile, false));
        pic.appendChild(img);
        picviewer.appendChild(pic);

        var simpleViewer = ((!tag_isdocument) || (scale >= 1));
        if (simpleViewer)
            dim_orig = [picwidth, picheight];

        var slider = null;
        if (!simpleViewer) {
            var piccontrols = document.createElement("div");
            piccontrols.className = "imagecontrols";
            slider = document.createElement("input");
            slider.setAttribute("type","range");
            slider.setAttribute("min","20");
            slider.setAttribute("max","130"); //slider maxzoom = 130
            slider.oninput = slider.onchange = function(evt) {
                fitPicInScreen(evt.currentTarget.value/100, false);
            };
            piccontrols.appendChild(slider);
            pic.appendChild(piccontrols);
            pic.style.cursor = "all-scroll";
        }

        pic.style.overflow = "hidden";
        pic.style.height = picheight+"px";
        pic.style.width = picwidth+"px";
        img.style.position="absolute";
        var dim100=dim.slice();

        var dragging = false;
        var last = [0,0];
        var unmoved=true;
        var pos = [0,0];
        var initialTouchDist = 0;
        var initialSliderValue = 100;
        var swipeStart = [null,null];
        var swipeTimeout=null;
        var fitPicInScreen = function(newscale, setslider) {
            if (newscale) {
                scale=Math.max(0.20,Math.min(newscale,1.30)); //slider maxzoom = 130
                var px=(pos[0]-targetwidth/2)/dim[0];
                var py=(pos[1]-targetheight/2)/dim[1];
                img.height = dim[1] = dim_orig[1]*scale;
                img.width = dim[0] = dim_orig[0]*scale;
                if (setslider && slider)
                    slider.value=""+(dim[0]/dim_orig[0])*100;

                pos[0]=px*dim[0]+targetwidth/2;
                pos[1]=py*dim[1]+targetheight/2;      
            }

            pos[0] = Math.max(pos[0],picwidth-dim[0]);
            pos[0] = Math.min(pos[0],0);
            pos[1] = Math.max(pos[1],picheight-dim[1]);
            pos[1] = Math.min(pos[1],0);
            img.style.top=pos[1]+"px";
            img.style.left=pos[0]+"px";
        };
        fitPicInScreen(initialScale,true);
        var mousedown = function(ev) {
            if (ev.target!=img && ev.target!=pic)
                return;
            var clientX, clientY;
            if (ev.touches) {
                if (ev.touches.length == 1) {
                    clientX = ev.touches[0].clientX;
                    clientY = ev.touches[0].clientY;
                    swipeStart=[clientX,clientY];
                    if (swipeTimeout)
                        clearTimeout(swipeTimeout);
                    swipeTimeout=setTimeout(function(){swipeStart=[null,null];swipeTimeout=null;},350);
                } else {
                    if (!simpleViewer && ev.touches.length == 2) {
                        initialTouchDist = euclidean_distance(ev.touches);
                        initialSliderValue = slider.value;
                        unmoved=true;
                        ev.preventDefault();
                        ev.stopPropagation();
                        return false;            
                    } else
                        return true;
                }
            }
            else {
                clientX = ev.clientX;
                clientY = ev.clientY;
            }
            dragging = true;
            last = [clientX-pos[0], clientY-pos[1]];
            unmoved=true;
            ev.preventDefault();
            ev.stopPropagation();
            return false;            
        };
        var mouseup = function(ev) {
            if (ev.target!=img && ev.target!=pic)
                return;
            dragging = false;
            if (ev.touches) {
                if (ev.touches.length == 0) {
                    initialTouchDist = 0;
                }
                if (!simpleViewer && ev.touches.length == 2) {
                    initialTouchDist = euclidean_distance(ev.touches);
                    initialSliderValue = slider.value;
                }
            }

            if (unmoved)
                closePicViewer();

            ev.preventDefault();
            ev.stopPropagation();
            return false;            
        };
        var mousemoved = function(ev) {
            if (ev.target!=img && ev.target!=pic)
                return;
            var clientX, clientY;
            if (ev.touches) {
                if (ev.touches.length == 1) {
                    clientX = ev.touches[0].clientX;
                    clientY = ev.touches[0].clientY;
                    if (swipeStart[0]!=null && swipeStart[1]!=null) {
                        var xdif = swipeStart[0]-clientX;
                        var ydif = swipeStart[1]-clientY;
                        var leftMargin = parseInt(pic.style.left) + picwidth/4;
                        var rightMargin = parseInt(pic.style.left) + 3*picwidth/4;
                        var dist = euclidean_distance_impl(swipeStart[0], swipeStart[1], clientX, clientY);
                        if (dist > picwidth/4) {
                            if (Math.abs(xdif) > Math.abs(ydif) &&
                                (clientX<leftMargin || clientX>rightMargin)) {
                                if (xdif<0) {
                                    nextPic();
                                } else {
                                    previousPic();
                                }
                                swipeStart=[null,null];
                                swipeTimeout=null;
                                ev.preventDefault();
                                ev.stopPropagation();
                                return false;            
                            }
                        }
                    }
                } else {
                    if (!simpleViewer && ev.touches.length == 2) {
                        var newdist = euclidean_distance(ev.touches);
                        var ratio = newdist/initialTouchDist;
                        if (ratio != 1.0)
                            unmoved=false;
                        var newv = initialSliderValue * ratio;
                        fitPicInScreen(newv/100, true);
                    }
                    ev.preventDefault();
                    ev.stopPropagation();
                    return false;            
                }
            }
            else {
                clientX = ev.clientX;
                clientY = ev.clientY;
            }
            var buttons = ev.buttons;
            if (window.event) 
                buttons = window.event.button || buttons;

            if (buttons == 0)
                dragging = false;

            if (dragging) {
                var diffx =  clientX - last[0];
                var diffy =  clientY - last[1];
                var relx = pos[0]-diffx;
                var rely = pos[1]-diffy;
                if (relx*relx + rely*rely > 10) {
                    unmoved=false;
                }
                pos[0]=diffx;
                pos[1]=diffy;

                fitPicInScreen();
            }
            ev.preventDefault();
            ev.stopPropagation();
            return false;            
        };
        pic.addEventListener("mousedown",mousedown); 
        pic.addEventListener("mouseup", mouseup);
        pic.addEventListener("mousemove", mousemoved);
        pic.addEventListener("touchstart",mousedown); 
        pic.addEventListener("touchend", mouseup);
        pic.addEventListener("touchmove", mousemoved);
        pic.addEventListener("wheel", function(evt)
        {
            var x = (evt.deltaX < 0)?-1:(evt.deltaX>0)?1:0; 
            var y = (evt.deltaY < 0)?-1:(evt.deltaY>0)?1:0; 

            pos[0]+=x*-10;
            pos[1]+=y*-10;
            fitPicInScreen();
            
            evt.stopPropagation();
            evt.preventDefault();
            return false;
        });


        bg.addEventListener("click", function() {
            closePicViewer();           
        });

        var capdiv = document.createElement('div');
        if (multipage)
            caption=caption+" (page "+(picpage+1)+" of "+(multipage.length+1)+")";
        capdiv.appendChild(document.createTextNode(caption));
        if (multipage) {
            if (picpage>0) {
                var prev2 = document.createElement("a");
                prev2.appendChild(document.createTextNode("prev"));
                prev2.addEventListener("click", previousPic);
                capdiv.appendChild(prev2);
            }

            if (picpage<multipage.length) {
                var next2 = document.createElement("a");
                next2.appendChild(document.createTextNode("next"));
                next2.addEventListener("click", nextPic);
                capdiv.appendChild(next2);
            }
        }
        var linkdiv = document.createElement('div');
        linkdiv.style["font-size"] = "90%";
        var linktext = tag_isdocument ? "This document refers to:"
            : "People in this picture:";
        linkdiv.appendChild(document.createTextNode(linktext));
        var linkClickHandler = function(evt) {
            closePicViewer();
            var id = evt.currentTarget.getAttribute("data-person_id");
            if (view)
                view.setFocus(null, id, true);
        };
        for (var i=0; i< peers.length; i++) {
            var pname = displayName(data["structure"][peers[i]]["name"]);
            var link = document.createElement('a');
            link.appendChild(document.createTextNode(pname));
            link.addEventListener("click", linkClickHandler);
            link.setAttribute("data-person_id", peers[i]);
            linkdiv.appendChild(link);
        }
        capdiv.style["border-radius"] = "7px 7px 7px 7px";
        capdiv.style.border="1px solid black";
        capdiv.appendChild(linkdiv);
        capdiv.style.position="relative";
        capdiv.style['background'] = "white";
        capdiv.style["text-align"] = "center";
        capdiv.style["top"] = (((totalheight - picheight - carouselheight) / 2)+picheight) +"px";
        capdiv.style["max-width"] = "80%";
        capdiv.style["margin"] = "auto";
        capdiv.style["font-size"] = "110%";
        picviewer.appendChild(capdiv);

        picviewer.style.display="block";
        picviewer.focus();
    };
    var activePicIds=[];
    var thumbEventListener = function(evt) {
        if (evt.target.hasAttribute("data-picinfo") ||
            evt.target.parentNode.hasAttribute("data-picinfo")) {
            var picid = evt.target.getAttribute("data-picinfo") ||
                evt.target.parentNode.getAttribute("data-picinfo");
            doPicViewer(activePicIds, JSON.parse(picid));
            evt.stopPropagation();
            return false;
        }
    };
    var thumbspane = document.createElement('div');
    thumbspane.addEventListener("click", thumbEventListener, false);
    thumbspane.className = "pvThumbspane";
    var some_hidden = [];
    var usedpiccount = 0;
    for (var i=0; i< picids.length; i++) {

        var picobj = data["pictures"]["picture_table"][picids[i]];
        var thumbpane = document.createElement('span');
        thumbpane.className = "unselectable";
        var pictag = filter(picobj["tag"]);
        if (pictag == -1)
            continue;
        if (limit && !pictag && usedpiccount>5)
                pictag = "more";
        if (!pictag)
                usedpiccount++;
        if (pictag && pictag != "") {
            thumbpane.className += " pvTag"+pictag+" pvHidden";
            some_hidden.addonce("pvTag"+pictag);
        }
        thumbpane.appendChild(loadLazyImage(getPicturesFilename(data, picids[i], true)));

        var text = document.createElement('div');
        text.appendChild(document.createTextNode(picobj["caption"]));

        thumbpane.appendChild(text);
        activePicIds.push(picids[i]);
        thumbpane.setAttribute("data-picinfo",JSON.stringify(activePicIds.length-1));

        thumbspane.appendChild(thumbpane);
    }
    for (var j=0; j<some_hidden.length; j++) {
        var hidden_tag = some_hidden[j];
        var toggle_refs = document.createElement('div');
        var a = document.createElement('a');
        a.setAttribute("data-tag",hidden_tag);
        var alltags = {
            "pvTagref": "references",
            "pvTagcen": "censuses",
            "pvTagmore": "more",
        };
        var text = document.createTextNode('Show '+(alltags[hidden_tag] || hidden_tag));
        a.appendChild(text);
        toggle_refs.appendChild(a);
        a.addEventListener("click", function(evt) {
            var mytag = evt.currentTarget.getAttribute("data-tag");
            evt.currentTarget.text = ((evt.currentTarget.text.slice(0,4)=="Show") ? "Hide" : "Show")
                + evt.currentTarget.text.slice(4);
            for (var i=0; i<thumbspane.childNodes.length; i++) {
                var chld = thumbspane.childNodes[i];
                if (hasClass(chld, mytag)) {
                    if (hasClass(chld, "pvHidden"))
                    {
                        removeClass(chld,"pvHidden");
                        thumbspane.loadThumbnails();
                    }
                    else
                        addClass(chld, "pvHidden");
                }
            }
        });
        thumbspane.appendChild(toggle_refs);
    }
    thumbspane.loadThumbnails = function() {
        for (var i=0; i<this.childNodes.length; i++) {
            var ix = this.childNodes[i];
            if (hasClass(ix, "pvHidden"))
                continue;
            for (var j=0; j<ix.childNodes.length; j++) {
                var jx = ix.childNodes[j];
                if (jx.tagName == "IMG") {
                    if (jx.hasAttribute("data-lazy-src")) {
                        var imgurl = jx.getAttribute("data-lazy-src");
                        var newimg = loadImage(imgurl);
                        jx.parentNode.replaceChild(newimg, jx);
                    }
                }
            }
        }
    };

    return thumbspane;
};

var getDetails = function(view, data, person, defaultPane) {
    var structure = data["structure"];
    var divtable={};
    var container = document.createElement('div');
    container.className = 'infoflex';


    var names = document.createElement('div');
    names.className = 'detaildatanames';
    container.appendChild(names);
    for (var i=0; i<person.names.length; i++)
    {
        var name = document.createElement('div');
        name.className = 'detaildataname';
        name.appendChild(document.createTextNode((i == 0 ? "" : 'a.k.a. ')+
            displayName(person.names[i]) ));
        if (i==0) {
            var connectionbutton=document.createElement('div');
            connectionbutton.addEventListener("click",
                function() {view.recreateTree({"style":"connection",
                        "target": firstPersonFromCookie()||data["config"]["initial_person"]});}
                );
            connectionbutton.className='detailconnectionbutton';
            name.appendChild(connectionbutton);
        }
        names.appendChild(name);
    }


    var tabs = document.createElement('div');
    tabs.className="detailtabselector";
    names.appendChild(tabs);

    var makeEventsPane = function() {
        var div_container=document.createElement('div');
        var handlePersonLink = function(evt) {
            if (evt.target.hasAttribute("data-person_id")) {
                view.setFocus(null, evt.target.getAttribute("data-person_id"), true);
                evt.stopPropagation();
                return false;
            }
        };
        div_container.className = "detaildatacontainer";

        div_container.addEventListener("click", handlePersonLink);
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
            };
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
            };
            var makePersonLink = function(id) {
                var a = document.createElement('a');
                a.appendChild(document.createTextNode(displayName(structure[id].name)));
                a.setAttribute("data-person_id",id);
                return a;
            };
            var putText = function(whereto, text) {
                if (text != "")
                    whereto.appendChild(document.createTextNode(text));
            };
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
                            putText(borninfo, relationshipToParent(person, structure[parents[j]].id));
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
    };
    var makeNotesPane = function() {
        var text = document.createElement('div');
        var lines = person["note"].split("\n");
        for (var i = 0; i<lines.length; i++) {
            var line = document.createElement("p");
            line.appendChild(document.createTextNode(lines[i]));
            text.appendChild(line);
        }
        return text;
    };
    var filterPresence = function(piclist, filter) {
        if (!piclist)
            return false;
        for (var i=0; i<piclist.length; i++) {
            var obj = data["pictures"]["picture_table"][piclist[i]];
            var filtered = filter(obj["tag"]);
            if (filtered != -1)
                return true;
        }
        return false;
    };
    var makeDocumentsPaneFilter = function(tag) {
        if (tag == "ref")
            return undefined;
        else if (tag == "cen")
            return tag;
        else
            return -1;
    };
    var makeDocumentsPane = function() {
        var pics = data["pictures"]["people_table"][person["id"]];
        return makeThumbnailPane(view, data, pics, makeDocumentsPaneFilter, true);
    };
    var makePicturesPaneFilter = function(tag) {
        if (tag == undefined)
            return tag;
        else
            return -1;
    };
    var makePicturesPane = function() {
        var pics = data["pictures"]["people_table"][person["id"]];
        return makeThumbnailPane(view, data, pics, makePicturesPaneFilter, true);
    };
    var makeBioPane = function() {
        return parseBioText(data["narratives"]["descs"][person["id"]], data, function(evt) {
            if (evt.target.hasAttribute("data-person_id")) {
                var person_id = evt.target.getAttribute("data-person_id");
                view.setFocus(null, person_id, true);
                evt.stopPropagation();
                return false;
            }
        });
    };

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
    };

    var content_container=document.createElement('div');
    content_container.className='detailcontentcontainer';
    container.appendChild(content_container);

    var extrabuttons=[];
    var pulsate = function(btn) {
        for (var i=0; i<extrabuttons.length; i++)
            if (extrabuttons[i]==btn) {
                addClass(extrabuttons[i], 'pulsate');
            } else {
                removeClass(extrabuttons[i],'pulsate');
            }
    };

    var tabButtonHandler = function(evt) {
        makeEmpty(content_container);
        content_container.appendChild(divtable[evt.currentTarget.getAttribute("data-mydiv")]);
        if (divtable[evt.currentTarget.getAttribute("data-mydiv")].loadThumbnails)
            divtable[evt.currentTarget.getAttribute("data-mydiv")].loadThumbnails();
        pulsate(evt.currentTarget);
    };
    var makeButton = function(title, div) {
        var el = document.createElement('span');
        el.appendChild(document.createTextNode(title));

        el.setAttribute("data-mydiv",title);
        divtable[title]=div;
        el.addEventListener("click",tabButtonHandler);
        return el;
    };
    var makeActionButton = function(title, fn) {
        var el = document.createElement('span');
        el.appendChild(document.createTextNode(title));

        el.addEventListener("click",fn);
        return el;
    };
    if (person["events"] && person["events"].length > 0) {
        extrabuttons.push(makeButton("Events", makeEventsPane()));
    }
    if (person["note"] && person["note"].length > 0) {
        extrabuttons.push(makeButton("Notes", makeNotesPane()));
    }
    if (data["narratives"]["descs"][person["id"]]) {
        extrabuttons.push(makeButton("Bio", makeBioPane()));
    }
    if (person["cites"] && person["cites"].length > 0) {
        extrabuttons.push(makeButton("Citations", makeCitesPane()));
    }
    if (filterPresence(data["pictures"]["people_table"][person["id"]], makePicturesPaneFilter)) {
        extrabuttons.push(makeButton("Pictures", makePicturesPane()));
    }
    if (filterPresence(data["pictures"]["people_table"][person["id"]], makeDocumentsPaneFilter)) {
        extrabuttons.push(makeButton("Documents", makeDocumentsPane()));
    }
    if (extrabuttons.length>1)
        for (var i=0; i<extrabuttons.length; i++)
            tabs.appendChild(extrabuttons[i]);
    defaultPane = defaultPane || 0;
    if (extrabuttons.length <= defaultPane)
        defaultPane = 0;
    if (extrabuttons.length > defaultPane)
    {
        content_container.appendChild(divtable[extrabuttons[defaultPane].getAttribute("data-mydiv")]);
        if (divtable[extrabuttons[defaultPane].getAttribute("data-mydiv")].loadThumbnails)
            divtable[extrabuttons[defaultPane].getAttribute("data-mydiv")].loadThumbnails();
        pulsate(extrabuttons[defaultPane]);
    }

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
    };
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
    if (!compact_mode) {
        if (birth)
            result = result.concat([detailFont, "\nborn "+birth]);
        if (death)
            result = result.concat([detailFont, "\ndied "+death]);
    }
    return result;
};

var Tree = function(layout_style, structure, person_id) {


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
        };
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
    };

    if (layout_style["style"] == "standard") {
        var anc = findAppropriateAncestor(person_id);
        if (anc == null) {
            displayError("Sorry, I can't find the ancestor with ID \""+person_id+"\"", true);
            return null;
        }
        person_id = anc;
    }

    var layout = Layout(layout_style, person_id, structure);
    var positioned = false;
    var nodes = layout.allNodes();

    return {
        flushDimensionCache: function() {
            positioned = false;
            layout.flushDimensionCache();
        },
        recalcNodeText: function() {
            layout.recalcNodeText();
        },
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
            positioned = true;
        },
        draw : function(view) {
            if (!positioned)
            {
                this.position(view);
            }
            for (var i=0; i<nodes.length; i++)
            {
                var node = nodes[i];
                node.draw(view);
                node.drawLines(view);
            }
        }
    };
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
        };
    };
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
    };
};

var View = function(data) {
        var structure = data["structure"];
        var details = data["details"];
        var config = data["config"];
        return {
        tree: null,
        scrollx : 0,
        scrolly : 0,
        targetx : 0,
        targety : 0,
        dragging : false,
        mousescaling : false,
        mousescaling_distance : 0,
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
            };
            this.canvas = document.getElementById("canvas");
            this.context = this.canvas.getContext("2d", options);
        },
        convert_client_point : function(x,y) {
            var bRect = this.canvas.getBoundingClientRect();
            var mouseX = (x - bRect.left)*(this.canvas.width/bRect.width);
            var mouseY = (y - bRect.top)*(this.canvas.height/bRect.height);
            return [mouseX, mouseY];
        },
        convert_tree_position_percentage: function(x,y) {
            var extents = this.tree.getTreeExtents();
            var treewidth = extents[2] - extents[0];
            var treeheight = extents[3] - extents[1];
            var xpercent = x / treewidth;
            var ypercent = y / treeheight;
            return [xpercent, ypercent];
        },
        convert_screen_percentage: function(x,y) {
            return [x/this.canvas.width, y/this.canvas.height];
        },


        get_mouse_pos : function(evt) {            
            return this.convert_client_point(evt.clientX, evt.clientY);
        },
        get_touch_pos : function(evt) {            
            if (evt.touches.length==0) {
                    return [this.lastclickposx,this.lastclickposy];
                }
            return this.convert_client_point(evt.touches[0].clientX, evt.touches[0].clientY);
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
                var oldx = mythis.scrollx;
                var oldy = mythis.scrolly;
                mythis.scrollx = Math.round(mythis.scrollx + mythis.easeAmount*(mythis.targetx - mythis.scrollx));
                mythis.scrolly = Math.round(mythis.scrolly + mythis.easeAmount*(mythis.targety - mythis.scrolly));
                if ((!mythis.dragging) && ((Math.abs(mythis.scrollx - mythis.targetx) < 0.1) 
                    && (Math.abs(mythis.scrolly - mythis.targety) < 0.1) || 
                    (oldx==mythis.scrollx && oldy==mythis.scrolly))) {
                        mythis.scrollx = Math.round(mythis.targetx);
                        mythis.scrolly = Math.round(mythis.targety);
                        mythis.dragtimer = null;
                }
                mythis.redraw();
                if (mythis.dragtimer!=null)
                    requestFrame(anim);
            };
            requestFrame(anim);
        },
        makeTree: function(layout_style, nodeid) {
            var tree = Tree(layout_style,structure,nodeid);
            return tree;
        },
        recreateTree: function(layout_style) {
            if (!layout_style)
                layout_style = null;
            this.setFocus(layout_style, this.focusId, false);
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

            var narrativewindow = document.getElementById("narrativewindow");
            if (isvisible(narrativewindow)) {
                // hacky check for mobile layout
                if (narrativewindow.offsetWidth > this.canvas.width * 0.9) {
                    // mobile view
                    top += narrativewindow.offsetHeight;
                } else {
                    // desktop view
                    left += narrativewindow.offsetWidth;
                }
            }

            return {"x":left+(right-left) / 2, "y":top+(bottom - top) / 2}; 
        },
        setFocusMaybePosition: function(layout, node, updatehistory) {
            var thenode = this.tree.lookupNodeById(node);
            if (thenode == null)
                this.setFocus(null, node, updatehistory);
            else {
                var node1 = thenode;
                this.setFocusPosition(layout, node, updatehistory, node1.getX()+this.scrollx, node1.getY()+this.scrolly);
            }
        },
        getDefaultStyle: function(default_default) {
            if (getArgument("layout")) {
                var ret = {"style": getArgument("layout")};
                if (getArgument("render_opts"))
                    ret["render_opts"]=getArgument("render_opts").split(",");
                 if (getArgument("generation_limit"))
                    ret["generation_limit"] = parseInt(getArgument("generation_limit"));
                if (getArgument("focus"))
                    ret["focus"]=getArgument("focus");
                if (getArgument("target"))
                    ret["target"]=getArgument("target");
                return ret;
            }
            else
                return {"style": "standard"};
        },
        setFocus: function(layout_style, node, updatehistory) {
            if (!layout_style)
                layout_style = this.getDefaultStyle();
            this.tree = this.makeTree(layout_style, node);
            if (this.tree == null)
                return;
            this.focusId = node;
            if (updatehistory)
                setHashArgument("i",node);

            var thenode = this.tree.lookupNodeById(node);
            this.tree.position(this);

            if (isvisible(document.getElementById("infowindow")))
                this.showDetailedView(node);

            if (thenode) {
                var the_center= this.findScreenCenter();
                this.scrollx = this.targetx = the_center.x - thenode.getX()-thenode.getWidth()/2;
                this.scrolly = this.targety = the_center.y -thenode.getY()-thenode.getHeight()/2;
                thenode.focused = true;
            } 
            this.canvas.focus();
            this.redraw();

        },
        setFocusPosition: function(layout_style, node,updatehistory,x,y) {
            if (!layout_style)
                layout_style = this.getDefaultStyle();
            this.tree = this.makeTree(layout_style, node);
            if (this.tree == null)
                return;
            this.focusId=node;
            if (updatehistory)
                setHashArgument("i",node);

            var thenode = this.tree.lookupNodeById(node);

            if (thenode) {
                this.tree.position(this);
                this.scrollx = x - thenode.getX();
                this.scrolly = y - thenode.getY();
                thenode.focused = true; this.canvas.focus();
            }
            this.redraw();

            if (isvisible(document.getElementById("infowindow")))
                this.showDetailedView(node);

            if (thenode) {
                var the_center= this.findScreenCenter();
                this.targetx = the_center.x - thenode.getX()-thenode.getWidth()/2;
                this.targety = the_center.y - thenode.getY()-thenode.getHeight()/2;
            }
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
                this.setFocusPosition(null, node1.getId(), true, node1.getX()+this.scrollx, node1.getY()+this.scrolly);
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
        showDetailedView : function(personId, defaultPane) {
            var mythis = this;
            this.lookupDetails(personId, function(mydetails) {
                if(mydetails == null)
                    displayError("Person lookup failed", true);
                else
                    showInfoWindow(getDetails(mythis, data, mydetails, defaultPane));
            });
        },
        stopDragging: function() {
            this.dragging = false;
            this.ismousedown = false;
            this.mousescaling = false;
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

        adjust_viewport_for_printing: function() {
            //called only in case of print mode
            //adjusts canvas size to tree, so that the whole
            //tree can be exported as a pngs
            var extents = this.tree.getTreeExtents();
            var x1 = extents[0];
            var y1 = extents[1];
            var x2 = extents[2];
            var y2 = extents[3];
            this.canvas.width = x2-x1+50;
            this.canvas.height = y2-y1+50;

            this.scrollx = -x1+25;
            this.scrolly = -y1+25;
            this.targetx = this.targety = 0;
            this.dragtimer = null;
            this.redraw();
        },

        set_canvas_size: function() {
            this.canvas.width = screenWidth();
            this.canvas.height = screenHeight();
            this.widgets.init(this);
        },

        zoom: function(increment, centerpoint, reloffset) {
            var MINFONT = 8;
            var MAXFONT = 30;

            // If we're already at an extreme, stop
            if ((allScalingFonts[0].getSize() > MAXFONT && increment > 0)
                || (allScalingFonts[0].getSize() < MINFONT && increment < 0))
                return false;

            // Unless you tell us otherwise, center of screen
            // is our fixed point
            if (centerpoint == undefined) {
                centerpoint = this.findScreenCenter();
                centerpoint.x = centerpoint.x - this.scrollx;
                centerpoint.y = centerpoint.y - this.scrolly;
                centerpoint = this.convert_tree_position_percentage(centerpoint.x, centerpoint.y);
            }

            // Actually resize stuff
            for (var i=0; i<allScalingFonts.length; i++) {
                var s = allScalingFonts[i].getSize();
                allScalingFonts[i].setSize(s+increment);
            }
            if (compact_mode != allScalingFonts[0].getSize() < MINFONT) {
                compact_mode = allScalingFonts[0].getSize() < MINFONT;
                this.tree.recalcNodeText();
            }

            // Reposition the tree based on the new sizes
            this.tree.flushDimensionCache();
            this.tree.position(this);

            /* Calculate the new scroll position based
               on parameters. Basically, if you are pinching,
               the point you are pinching on should remain
               in the same point on the screen. If you clicked
               the zoom button, the center of the screen
               should remain stationary. centerpoint contains
               x,y proportions 0,0<=x,y<=1,1 of the position of
               pinch relative to the tree. reloffset contains
               the proportions of the pinch relative to the screen.
               Below we just match those up. */
            var newextents = this.tree.getTreeExtents();
            var newtreewidth = newextents[2] - newextents[0];
            var newtreeheight = newextents[3] - newextents[1];
            var screencenter = this.findScreenCenter();
            var relx = screencenter.x;
            var rely = screencenter.y;
            if (reloffset != undefined) {
                relx = reloffset[0] * this.canvas.width;
                rely = reloffset[1] * this.canvas.height;
            }
            this.scrollx = this.targetx = screencenter.x - (newtreewidth * centerpoint[0]) - (screencenter.x-relx);
            this.scrolly = this.targety = screencenter.y - (newtreeheight * centerpoint[1]) - (screencenter.y-rely);

            this.redraw();
            return true;
        },

        touch_distance: function(touches) {
            return euclidean_distance(touches);
        },
        touch_center: function(touches) {
            var x1 = touches[0].clientX;
            var y1 = touches[0].clientY;
            var x2 = touches[1].clientX;
            var y2 = touches[1].clientY;
            var x = (x1+x2)/2;
            var y = (y1+y2)/2;
            return [x,y];
        },

        mousescale: function(state, evt) {
            var INC = 10;
            switch (state)
            {
                // TODO
                // smoother scaling (simulate fractional font point size changes?)
                case 0:
                    this.stopDragging();
                    if (evt.touches.length != 2)
                        return;
                    this.mousescaling = true;
                    this.mousescaling_distance = this.touch_distance(evt.touches);
                    break;
                case 1:
                    if (evt.touches.length != 2)
                        return;
                    var center = this.touch_center(evt.touches);
                    center = this.convert_client_point(center[0], center[1]);
                    var mousescaling_screenpos = this.convert_screen_percentage(center[0], center[1]);
                    var centerpoint = this.convert_tree_position_percentage(center[0]-this.scrollx, 
                            center[1]-this.scrolly);
                    var newdist = this.touch_distance(evt.touches);
                    if (newdist > this.mousescaling_distance+INC) {
                        this.zoom(1, centerpoint, mousescaling_screenpos);
                        this.mousescaling_distance = newdist; }
                    else if (newdist < this.mousescaling_distance-INC) {
                        this.zoom(-1, centerpoint, mousescaling_screenpos);
                        this.mousescaling_distance = newdist; }
                    break;
                case 2:
                    if (evt.touches.length == 0)
                        this.stopDragging();
                    break;
                default:
                    debug("Unexpected touch state");
            }
        },

        init : function(initial_style, initial_focus) {
            var mythis = this;
            this.init_canvas();
            this.set_canvas_size();
            this.setFocus(initial_style, initial_focus, false);

            this.canvas.addEventListener("mousedown", function(evt){ mythis.mousedown(evt.buttons, mythis.get_mouse_pos(evt)); }, false);
            this.canvas.addEventListener("mouseup", function(evt){ mythis.mouseup(evt.buttons, mythis.get_mouse_pos(evt)); }, false);
            this.canvas.addEventListener("mousemove", function(evt){ mythis.mousemove(evt.buttons, mythis.get_mouse_pos(evt)); }, false);
            this.canvas.addEventListener("wheel", function(evt)
            {
                var x = (evt.deltaX < 0)?-1:(evt.deltaX>0)?1:0; 
                var y = (evt.deltaY < 0)?-1:(evt.deltaY>0)?1:0; 

                mythis.targetx += x*-15;
                mythis.targety += y*-15;
                mythis.startDragTimer();
                
                evt.stopPropagation();
                evt.preventDefault();
                return false;
            },false);

            this.canvas.addEventListener("touchstart", function(evt){ 
                if (evt.touches.length == 2)
                    mythis.mousescale(0, evt);
                else
                    mythis.mousedown(1, mythis.get_touch_pos(evt));
                 evt.preventDefault();
                 evt.stopPropagation();}, false);
            this.canvas.addEventListener("touchend", function(evt){ 
                if (mythis.mousescaling)
                    mythis.mousescale(2, evt);
                else
                    mythis.mouseup(1, mythis.get_touch_pos(evt)); 
                evt.preventDefault();
                evt.stopPropagation();}, false);
            this.canvas.addEventListener("touchmove", function(evt){
                if (mythis.mousescaling)
                    mythis.mousescale(1, evt);
                else
                    mythis.mousemove(1, mythis.get_touch_pos(evt)); 
                evt.stopPropagation();
                evt.preventDefault();}, false);

            document.addEventListener("keydown", function(evt){
                var newtarget = null;

                //avoid breaking standard system functionality
                if (evt.ctrlKey || evt.altKey)
                    return;
                switch (evt.keyCode) {
                    case 89: // y
                        compact_mode = !compact_mode;
                        mythis.recreateTree();
                        break;
                    case 85: // u
                        mythis.doPrintMode();
                        break;
                    case 73: // i
                        mythis.recreateTree({"style":"subtree"});
                        break;                        
                    case 79: // o
                        mythis.recreateTree({"style":"connection","target":firstPersonFromCookie()||data["config"]["initial_person"]});
                        break;
                    case 80: // p
                        mythis.recreateTree({"style":"pedigree" });
                        break;
                    case 173: case 189://minus
                        mythis.zoom(-1);
                        evt.preventDefault();
                        break;
                    case 61: case 187://plus
                        mythis.zoom(+1);
                        evt.preventDefault();
                        break;
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
                    case 90: case 88: case 67: case 86: case 66: case 78:
                        var keys = [90,88,67,86,66,78];
                        mythis.showDetailedView(mythis.focusId, keys.indexOf(evt.keyCode));
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
                if (newtarget != null && newtarget.getId() != null) {
                    mythis.setFocusPosition(null, newtarget.getId(), true, newtarget.getX()+mythis.scrollx, newtarget.getY()+mythis.scrolly);

                }
            }, false);
            window.addEventListener("resize", function(evt){
                mythis.set_canvas_size(); 
                mythis.adjustVisibleArea();
                mythis.redraw();}, false);
            window.addEventListener("hashchange", function(evt) {
                closePicViewer();
                var myhash = getArgument("i");
                if (myhash == undefined)
                    myhash = initial_focus;
                if (mythis.focusId == myhash)
                    return;
                mythis.setFocus(null, myhash, false);
            });
        },
        convertToGrayscale: function() {
            aesthetic_table = aesthetic_table_bw;
            var keys = Object.keys(resources);
            for (var i=0; i< keys.length; i++) {
                resources[keys[i]] = grayscalify(resources[keys[i]]);
            }
            this.redraw();
        },
        doPrintMode: function() {
            print_mode = true;
            this.adjust_viewport_for_printing();
            this.redraw();
            if (this.canvas.toBlob && URL.createObjectURL && useObjectUrl) {
                //This approach works in Chrome
                //but breaks for make-book, which expects a dataurl
                this.canvas.toBlob(function(blob){
                    window.location.href = URL.createObjectURL(blob);
                }, "image/png");
            } else {
                //old style, fallback
                window.location.href = this.canvas.toDataURL("image/png");
            }
            print_mode = false;
            this.set_canvas_size();
            this.redraw();
        },
        adjustVisibleArea: function() {
            var changed = false;
            var extents = this.tree.getTreeExtents();
            if (extents == null)
                return;
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
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            if (this.tree != null)
                this.tree.draw(this);
            this.widgets.draw(this);
        },
    };
};

var renderRedirect = function(args) {
    var out = [];
    for (var i=0; i<args.length; i++)
        out.push(encodeURIComponent(args[i][0]) + "=" + encodeURIComponent(args[i][1]));
    document.location.href = "render.html#" + encodeURIComponent(out.join("&"));
};

var getHashString = function() {
    var myhash = window.location.hash;
    if (myhash[0] == "#")
        myhash = myhash.substr(1);
    return decodeURIComponent(myhash);
};

var getHashStringArg = function(name) {
    var hs = getHashString();
    var vars = hs.split("&");
    for (var i=0; i<vars.length; i++)
    {
        var pair = vars[i].split("=");
        if (name == decodeURIComponent(pair[0]))
            return decodeURIComponent(pair[1]);
    }
    return undefined;
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

var setHashArgument = function(name, val) {
    var hs = getHashString();
    var vars = hs.split("&");
    var found = false;
    var results = [];
    val=encodeURIComponent(val);
    for (var i=0; i<vars.length; i++)
    {
        var pair = vars[i].split("=");
        if (pair[0]=="" || pair.length!=2)
            continue;
        if (name == decodeURIComponent(pair[0])) {
            pair[1] = val;
            found = true;
        }
        results.push(pair.join("="));
    }
    if (!found)
        results.push([encodeURIComponent(name),val].join("="));
    window.location.hash=encodeURIComponent(results.join("&"));
};

var getArgument = function(name) {
    return getHashStringArg(name) || QueryString[name];
};

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
    div.addEventListener("click",personLinkHandler);

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
                        a.setAttribute("data-person_id", link);
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

    var time = Math.max(0.1, Math.min(Math.abs(scrollY - scrollTargetY) / speed, 0.8));

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

var generateOtherNarrative = function(data) {
    var narrative = [];
    var nototherpeople = [];
    for (var i=0; i<data["narratives"]["spec"].length; i++) {
        console.log(data["narratives"]["spec"][i]["name"]);
        var narr = generateNarrative(data, data["narratives"]["spec"][i]);
        for (var j=0; j<narr["indvs"].length; j++)
            nototherpeople.addonce(narr["indvs"][j]["id"]);
    }

    for (var i=0; i<data["structure_raw"].length; i++) {
        var mid = data["structure_raw"][i]["id"];
        if (nototherpeople.indexOf(mid) < 0) {
            var val = {"id": mid, "indent":0, "gen":[]}
            narrative.push(val);
        }
    }
    return {"name":"Other","indvs":narrative,"emptybios":false};
};

var getNarrSpecFromData = function (data, narrname) {
    for (var i=0; i<data["narratives"]["spec"].length; i++) {
        if (data["narratives"]["spec"][i]["name"] == narrname) {
            var narr = data["narratives"]["spec"][i];
            return narr;
        }
    } 
    return null;
};

var generateNarrative = function(data, spec) {
    if (!spec)
        return null;

    var next_gen_inc;
    var next_gen;
    if (spec["dir"]=="down") {
        next_gen_inc=1;
        next_gen="children";
    } else if(spec["dir"]=="up") {
        next_gen_inc=-1;
        next_gen="parents";
    } else return null;

    var narrative = [];
    var seen = {};
    for (var i=0; i<spec["roots"].length; i++) {
        var aroot = spec["roots"][i];
        var rec = function(scion, who, depth) {
            var mustadd = true;
            if (seen[who])
                seen[who]["gen"].push([depth, scion]);
            else {
                var val = {"id": who, "indent":depth, "gen":[[depth, scion]]};
                seen[who] = val;

                // Place individual adjacent to spouse, if spouse also appears in
                // narrative by descent
                if (spec["adjacent_spouse"])
                    for (var k=0; k<data["structure"][who]["spouses"].length; k++) {
                        var spouse = data["structure"][who]["spouses"][k];
                        if (seen[spouse]) {
                            seen[who]["indent"] = seen[spouse]["indent"];
                            mustadd=false;
                            if (!seen[spouse]["spouse"])
                                seen[spouse]["spouse"] =[];
                            seen[spouse]["spouse"].addonce(val);
                        }
                    }
                if (mustadd)
                    narrative.push(val);

            }

            // Recurse through kids, putting important ones first
            var kids = data["structure"][who][next_gen];
            var newkids = [];
            for (var j=0; j<kids.length; j++)
                if (spec["priority_siblings"].indexOf(kids[j]) >= 0)
                    newkids.unshift(kids[j]);
                else
                    newkids.push(kids[j]);
            for (var j=0; j<newkids.length; j++)
                rec(scion, newkids[j], depth+next_gen_inc);
        };
        rec(aroot, aroot, 0);
    }
    var newnarrative=[];

    // Clean up spousal movement
    for (var i=0; i<narrative.length; i++) {
        var n = narrative[i];
        newnarrative.push(n);
        if (n["spouse"]) {
            var spouse = n["spouse"];
            for (var j=0; j<spouse.length; j++) {
               newnarrative.push(spouse[j]);
            }
            delete n["spouse"];
        }

        // add additional spouses, even if they are not part of the descent
        if (spec["spouses"]!=false) {
            for (var k=0; k<data["structure"][n["id"]]["spouses"].length; k++) {
                var spouse = data["structure"][n["id"]]["spouses"][k];
                var spouse_val= {"id": spouse, "indent":n["indent"], "gen":[["spouse",n["id"]]]};
                if (!seen[spouse]) {
                    newnarrative.push(spouse_val);
                    seen[spouse]=spouse_val;
                }
            }
        }
    }
    return {"name":spec["name"],"indvs":newnarrative,"emptybios":spec["emptybios"]};
};

var getGallerySelectionsForEveryone = function(data) {
    return {"indvs":data["structure_raw"], "name":"Everyone"};
};

var getGallerySelectionsByFamily = function(data, narrname) {
    var spec = getNarrSpecFromData(data, narrname);
    if (spec == null)
        return null;
    var result = generateNarrative(data, {"roots":spec["roots"],"dir":"down",
        "emptybios":true, "spouses":true, "adjacent_spouse":false, "priority_siblings":[], "name":spec["name"]});
    return result;
};

var showReverseNarrative = function(data, view, id) {

    if (!data["structure"][id]) {
        displayError("Named narrative was not found",false);
        return undefined;
    }

    var spec = generateNarrative(data, {"roots":[id], 
        "adjacent_spouse": false, "spouses":false, "priority_siblings":[],"dir":"up",
        "emptybios":true,"name":displayName(data["structure"][id]["name"])});

    spec["tree_style"] = {"style":"pedigree", "focus":id};

    return showNarrative(data, view, spec);

};

var showNarrative = function(data, view, narr) {

    var narrativebody = document.getElementById("narrativebody");

    var mkText = function(tag, txt, cls) {
        var el = document.createElement(tag);
        el.appendChild(document.createTextNode(txt));
        if (cls)
            el.className = cls;
        return el;
    };

    var personLinkHandler = function(evt) {
        if (evt.target.hasAttribute("data-person_id")) {
            var person_id = evt.target.getAttribute("data-person_id");

            for (var i=0; i<narrativebody.childNodes.length; i++) {
                var child = narrativebody.childNodes[i];
                if (!child.hasAttribute("data-person_id"))
                    continue;
                if (child.getAttribute("data-person_id") == person_id) {
                    scrollToY(narrativebody, child.offsetTop, 400, 'easeInOutQuint');
                    evt.stopPropagation();
                    return false;
                }
            }

            // Linked person isn't in current narrative, so just show them in the tree
            view.setFocus(null, person_id, false);
            evt.stopPropagation();
            return false;
        }
    };

    var relationshipName = function(distance, sex) {
        if (typeof distance == "string")
            return distance;
        if (distance == 0)
            return "self";
        var sexmap = (distance>=0)?{
            "m": "son",
            "f": "daughter"
        }:{
            "m": "father",
            "f": "mother"
        };
        distance = Math.abs(distance);
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
        personDiv.className = "narrativePerson narrativePerson" + Math.abs(generation);
        personDiv.setAttribute("data-person_id", person["id"]);

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
        if (generation!=0)
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
                        text+=" and ";
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
                        text+=", ";
                    text+="#{" + person["children"][i]+ "}";
                }
                text += "#{}";
            }
            text = parseBioText(text, data, personLinkHandler);
            personDiv.appendChild(text);
        }


        if (data["pictures"]["people_table"][person["id"]]) {
            var tnpane=makeThumbnailPane(view, data, data["pictures"]["people_table"][person["id"]],
                function(tag) {return tag;}, true);
            personDiv.appendChild(tnpane);
            personDiv.loadThumbnails = function() {
                tnpane.loadThumbnails();
            };
        }


        return personDiv;
    };

    if (!narr) {
        displayError("Named narrative was not found",false);
        return;
    }
    var indvs = narr["indvs"];
    var narrname = narr["name"];

    makeEmpty(narrativebody);

    narrative_tree_style = narr["tree_style"] || null;
    var section = null;
    var header = mkText("div", "The "+narrname+" Narrative");
    header.className="narrativeHeader";
    narrativebody.appendChild(header);
    var first_indv=null;
    for (var i=0; i<indvs.length; i++) {
        var id = indvs[i]["id"];
        if (first_indv==null)
            first_indv = id;
        var gen = indvs[i]["gen"];
        var primarygen = indvs[i]["indent"];
        primarygen = Math.min(5, Math.max(-5, primarygen));

        // This conditional skips people for whom I don't have
        // a writen narrative. However. makeSection can generate
        // a stub text with basic information.
        if (data["narratives"]["descs"][id] || narr["emptybios"]) {
            section = makeSection(primarygen, indvs[i], data["structure"][id], data["narratives"]["descs"][id]);
            narrativebody.appendChild(section);
        }
    }

    // This is not great, as the size will change if you resize
    // but we need the blank space so you can scroll all the way to the last person
    var blankspace=document.createElement('div');
    var _buffer = null;
    narrativebody.onscroll = function(){
        if (!_buffer) {
            _buffer = setInterval(function() {
                var extraSpace = Math.max(0, narrativebody.offsetHeight - section.offsetHeight);    
                blankspace.style["margin-bottom"] = extraSpace+"px";
                _buffer = null;
            }, 300);            
        }
    };
    narrativebody.appendChild(blankspace);

    var narrativewindow = document.getElementById("narrativewindow");
    fadeIn(document.getElementById("infowindow"),0.15,"block");
    fadeIn(narrativewindow,0.15,"block");


    // force a scroll event in a hacky way
    narrativebody.setAttribute("data-last_viewed_person","!");
    narrativebody.scrollTop = 1;
    narrativebody.setAttribute("data-last_viewed_person", "");
    narrativebody.scrollTop=0;
    return first_indv;
};

var initNarrative = function(data, view) {
    document.getElementById("closenarrativewindow").onclick = function(evt) {
        var narrativewindow = document.getElementById("narrativewindow");
        fadeOut(narrativewindow,0.15);
    };
    var narrativelist = document.getElementById("narrativelist");
    var narrativeClickHandler = function(evt) {
        if (evt.target.hasAttribute("data-narr")) {
            var which = evt.target.getAttribute("data-narr");
            showNarrative(data, view, generateNarrative(data, getNarrSpecFromData(data, which)));
            evt.stopPropagation();
            return false;
        }
        narrativelist.style.display="none";
    };
    narrativelist.addEventListener("click", narrativeClickHandler);
    for (var i=0; i< data["narratives"]["spec"].length; i++) {
        var el = document.createElement('div');
        el.appendChild(document.createTextNode(data["narratives"]["spec"][i]["name"]));
        el.className="searchresult";
        el.setAttribute("data-narr",data["narratives"]["spec"][i]["name"]);
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
            if (!child.hasAttribute("data-person_id"))
                continue;
            removeClass(child, "narrativeHighlight");
            if (child.getAttribute("data-person_id") == id)
                addClass(child, "narrativeHighlight");
        }
    };
    narrativebody.addEventListener("scroll", function(evt) {

        if (!_buffer) {

            _buffer=setTimeout(function() {
                for (var i=0; i<narrativebody.childNodes.length; i++) {
                    var child = narrativebody.childNodes[i];
                    if (!child.hasAttribute("data-person_id"))
                        continue;
                    if (!child.hasAttribute("data-thumbnails-loadad") &&
                        child.offsetTop <= narrativebody.scrollTop + narrativebody.getBoundingClientRect().height &&
                        child.offsetTop + child.getBoundingClientRect().height >= narrativebody.scrollTop) {
                        if (child.loadThumbnails)
                            child.loadThumbnails();
                        child.setAttribute("data-thumbnails-loadad",  true);
                    }
                }
                for (var i=0; i<narrativebody.childNodes.length; i++) {
                    var child = narrativebody.childNodes[i];
                    if (!child.hasAttribute("data-person_id"))
                        continue;
                    var last = narrativebody.getAttribute("data-last_viewed_person");
                    if (last == "!")
                        return;
                    if (child.offsetTop >= narrativebody.scrollTop &&
                        child.offsetTop <= narrativebody.scrollTop + narrativebody.getBoundingClientRect().height ) {
                        var id = child.getAttribute("data-person_id");
                        if (id != last) {
                            narrativebody.setAttribute("data-last_viewed_person", id);
                            setHighlight(id);
                            view.setFocusMaybePosition(narrative_tree_style, id, last == "");
                        }
                        break;
                    }
                }
                _buffer=null;
            }, 400);
        }


    });
};

var initGallery = function(data, spec) {
    var galleryviewer = document.getElementById("galleryviewer");
    makeEmpty(galleryviewer);
    var header = document.createElement("div");
    header.appendChild(document.createTextNode("The "+spec["name"]+" Gallery"));
    header.className="narrativeHeader";
    galleryviewer.appendChild(header);
    galleryviewer.style.display="block";

    var pics = [];
    for (var j=0; j<spec["indvs"].length; j++) {
        var indv = spec["indvs"][j]["id"];
        if (data["pictures"]["people_table"][indv])
            for (var k=0; k<data["pictures"]["people_table"][indv].length; k++)
                pics.addonce(data["pictures"]["people_table"][indv][k]);
    }

    var pane = makeThumbnailPane(undefined, data, pics,
        function(tag) {return tag;}, false );
    pane.loadThumbnails();

    galleryviewer.appendChild(pane);
};

var initButtons = function(data, view) {
    var structure = data["structure"];
    var nameindex = data["structure_raw"];
    var help_handler = function(evt) {
        var helptext=("<b>Welcome to the Family Tree Viewer 2.0</b><br>"+
            "Here are some tips for using the program:<br><ol>"+
            "<li> Move around the tree by clicking and dragging on the background."+
            "<li> You can focus on a family member by clicking on him or her. That person will move to the center of the screen."+
            "<li> Not all family members are shown at once. The <img src=\"images/uparrow.png\"> icon means that the family member has hidden ancestors. The <img src=\"images/downarrow.png\"> means that the family members has hidden children. Focus on a family member to show his or her hidden relatives."+
            "<li> When you focus on a family member, more details be displayed, if available: life events, biographical data, relevant documents, and photographs. Click on the appropriate button at the top of this window to browse available details."+
            "<li> To find a relative by name, type the name into the search box. If you start typing, the program will suggest similar names. Click on a suggested name to select it."+
            "<li> You can use the <b>+</b> and <b>-</b> buttons in the upper left to adjust the font size."+
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
            div_container.addEventListener("click", function(evt) {
                if (evt.target.hasAttribute("data-person_id")) {
                    view.setFocus(null, evt.target.getAttribute("data-person_id"), true);
                    evt.stopPropagation();
                    return false;
                }
            }, false);

            var div_row = null;
            var div_surname = null;
            var div_names = null;
            var new_row = true;
            var previous_date = "";
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
                a.setAttribute("data-person_id", id);
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

        };

        var makeViews = function() {
            var div = document.createElement('div');
            div.appendChild(document.createTextNode("Select an alternative view of the tree."));
            for (var i=0; i<2; i++)
                div.appendChild(document.createElement('br'));

            var views = [["Connection view",function() {view.recreateTree({"style":"connection",
                            "target": firstPersonFromCookie()||data["config"]["initial_person"]});}],
                         ["Pedigree view",function () {view.recreateTree({"style":"pedigree" });}],
                         ["Subtree view",function () {view.recreateTree({"style":"subtree" });}] ];

            for (var i=0; i<views.length; i++) {
                var v = views[i];
                var a = document.createElement('a');
                a.appendChild(document.createTextNode(v[0]));
                a.addEventListener("click", v[1]);
                div.appendChild(a);
                div.appendChild(document.createElement('br'));
            }

            return div;
        };

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
                if (evt.target.hasAttribute("data-person_id")) {
                    view.setFocus(null, evt.target.getAttribute("data-person_id"), true);
                    evt.stopPropagation();
                    return false;
                }
            };
            div_container.addEventListener("click", handlePersonLink);
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
                a.setAttribute("data-person_id", data["structure_raw"][i]["id"]);
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

        };
        var container = document.createElement('div');
        container.className = 'infoflex';
        var names = document.createElement('div'); names.className ='detaildatanames';
        container.appendChild(names);
        var name = document.createElement('div'); name.className='detaildataname';
        names.appendChild(name);
        name.appendChild(document.createTextNode('Help'));

        var tabs = document.createElement('div');
        tabs.className="detailtabselector";
        name.appendChild(tabs);

        var helptextdiv = document.createElement('div');
        helptextdiv.className='detailcontentcontainer';
        helptextdiv.innerHTML = helptext;
        container.appendChild(helptextdiv);

        var buttons = [["About viewer", function() {helptextdiv.innerHTML = helptext;}],
                       ["About tree", function() {helptextdiv.innerHTML = abouttext;}],
                       ["Index", function() {makeEmpty(helptextdiv);
                                             helptextdiv.appendChild(makeIndex());}],
                       ["Birthdays", function() {makeEmpty(helptextdiv);
                                                 onDemandLoad(data, "birthdays", function(bd) {
                                                   helptextdiv.appendChild(makeBirthdays(bd)); });  }],

                       ["View", function() {makeEmpty(helptextdiv);
                                            helptextdiv.appendChild(makeViews()); } ]
                        ];
        for (var i=0; i<buttons.length; i++) {
            var btn = document.createElement("span");
            btn.addEventListener("click", buttons[i][1]);
            btn.appendChild(document.createTextNode(buttons[i][0]));
            tabs.appendChild(btn);
        }

        showInfoWindow({"text":container});
    };
    document.getElementById("helpbutton").onclick = help_handler;
    document.getElementById("helpbutton2").onclick = help_handler;

    document.getElementById("closeinfowindow").onclick = function(evt) {
        fadeOut(document.getElementById("infowindow"),0.15);
    };
    document.getElementById("zoomin").onclick = function(evt) {
        view.zoom(+1);
    };
    document.getElementById("zoomout").onclick = function(evt) {
        view.zoom(-1);
    };
};

var initSearch = function(data, searchtext, searchlist, searchHandler) {
    var structure = data["structure"];
    var nameindex = data["structure_raw"];

    var doSearch = function(text) {
        // TODO binary search?
        text = text.trim().toLowerCase();
        if (text == "") {
            displayError("Please enter a name into the search box, then press enter.", false);
            return;
        }
        for (var i=0; i<nameindex.length; i++)
            if (displayName(nameindex[i]["name"]).toLowerCase() == text) {
                searchHandler(nameindex[i]["id"]);
                return;
            }
        displayError("Sorry, \""+text+"\" does not exist in this tree. Please note that you must enter the name exactly.", false);
    };
    searchtext.addEventListener("focus",function(evt){
        evt.currentTarget.setSelectionRange(0, evt.currentTarget.value.length);
    });
    searchtext.addEventListener("keydown",function(evt) {
        if (evt.keyCode == 13)
            doSearch(searchtext.value);
        evt.stopPropagation();
        return false;
    });
    searchtext.addEventListener("blur",function(evt){searchlist.style.display="none";});
    var searchResultEventListener = function(evt) {
        if (evt.target.hasAttribute("data-search_id")) {
            searchHandler(evt.target.getAttribute("data-search_id"));
            searchtext.value = displayName(structure[evt.target.getAttribute("data-search_id")]["name"]);
            evt.stopPropagation();
            return false;
        }
    };
    searchlist.addEventListener("mousedown",searchResultEventListener);

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
                if (searchlist.scrollIntoView)
                    searchlist.scrollIntoView();

                var el = document.createElement('div');
                el.className = "searchresult";
                var lifefrom = nameindex[i]["birth"][0];
                var lifeto = nameindex[i]["death"][0];
                var range="";
                if (lifefrom || lifeto)
                    range = " ("+lifefrom+"-"+lifeto+")";
                el.textContent=displayName(nameindex[i]["name"]) + range;
                el.setAttribute("data-search_id",nameindex[i]["id"]);
                searchlist.appendChild(el);
            }
        }
        if (!somematch)
            searchlist.style.display="none";  
    });

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

var firstPersonFromCookie = function() {
    if (typeof getCookieKey !== 'undefined') {
        var ret = getCookieKey("fvself");
        if (ret == "")
            return undefined;
        return ret;
    } else
        return undefined;
};

var main = function() {
    var loadingwindow = document.getElementById("loadingwindow");
    if (!browserOkay()) {
        loadingwindow.style.display = "none";
        displayError("Your web browser is too old to use this program. Please upgrade to a modern browser and try again. I suggest <a href='https://www.google.com/chrome/browser/desktop/index.html'>Chrome</a> or <a href='https://www.mozilla.org/firefox/new/'>Firefox</a>.", true);
        return;
    }

    loadResources();

    loadData(function(data) {
        fadeOut(loadingwindow);
        if (data == null) {
            displayError("Error loading required data from server. Try refreshing the page.", true);
            return;
        }

        if (getArgument("gallery")) {
            var who = getArgument("gallery");
            if (who == "everyone")
                initGallery(data, getGallerySelectionsForEveryone(data));
            else
                initGallery(data, getGallerySelectionsByFamily(data, who));
        }
        else {

            var view = View(data);
            initButtons(data, view);
                var searchtext = 
            initSearch(data, document.getElementById("searchtext"), document.getElementById("searchlist"), 
                function(id) {view.setFocus(null, id, true);});
            initNarrative(data, view);

            var first_person = getArgument("i") || firstPersonFromCookie() || data["config"]["initial_person"];
            var first_layout = null;

            if (getArgument("narr")) {
                if (getArgument("narr")=="other")
                    showNarrative(data, view, generateOtherNarrative(data));
                else
                    first_person = showNarrative(data, view, generateNarrative(data, getNarrSpecFromData(data, getArgument("narr")))) || first_person;
            } else if (getArgument("rnarr")) {
                 first_person = showReverseNarrative(data, view, getArgument("rnarr")) || first_person;
            } else if (getArgument("connection")) {
                var who = getArgument("connection");
                first_layout = {"style":"connection", "target":who};
            }

            view.init(first_layout, first_person);

            if (getArgument("bw"))
                view.convertToGrayscale();
            if (getArgument("doPrintMode"))
                view.doPrintMode(); 
        }
    });
};
