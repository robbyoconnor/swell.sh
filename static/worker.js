importScripts("lib/lodash.min.js")
importScripts("lib/es6-promise.auto.min.js")
importScripts("lib/fetch.umd.js")

if(!console) {
    var console = {log: function() {}, error: function() {}, table: function() {}}
}

var N = 64  //num of pts in resampled path
var NBest = 15

var reservedWords = {}

//word -> {path: point[], pathDistance: number}
var DICTIONARY = {}

// TODO: fix these hard code
var CENTERS = {
    q: {x:0.05 , y:1/8},
    w: {x:0.15 , y:1/8},
    e: {x:0.25 , y:1/8},
    r: {x:0.35 , y:1/8},
    t: {x:0.45 , y:1/8},
    y: {x:0.55 , y:1/8},
    u: {x:0.65 , y:1/8},
    i: {x:0.75 , y:1/8},
    o: {x:0.85 , y:1/8},
    p: {x:0.95 , y:1/8},

    a: {x:0.1  , y:3/8},
    s: {x:0.2  , y:3/8},
    d: {x:0.3  , y:3/8},
    f: {x:0.4  , y:3/8},
    g: {x:0.5  , y:3/8},
    h: {x:0.6  , y:3/8},
    j: {x:0.7  , y:3/8},
    k: {x:0.8  , y:3/8},
    l: {x:0.9  , y:3/8},

    z: {x:0.2  , y:5/8},
    x: {x:0.3  , y:5/8},
    c: {x:0.4  , y:5/8},
    v: {x:0.5  , y:5/8},
    b: {x:0.6  , y:5/8},
    n: {x:0.7  , y:5/8},
    m: {x:0.8  , y:5/8}
}

// a, b: pt {x, y}
var dist = function(a, b) {
    return Math.sqrt((a.x-b.x)*(a.x-b.x)+(a.y-b.y)*(a.y-b.y))
}

// pts: list of pt
var totalDistance = function(pts) {
    var S = 0
    for(var i = 1; i < pts.length; i++) {
        S += dist(pts[i], pts[i-1])
    }
    return S
}

var resample = function(pts) {
    var S = totalDistance(pts)
    if(S === 0){
        return [pts[0]]
    }
    var I = S / (N-1)

    // console.log(I)

    var D = 0.0
    var newPoints = [pts[0]]

    for(var i = 1; i < pts.length; i++){

        var d = dist(pts[i-1], pts[i])
        if((D+d)>=I){
            var qx = pts[i-1].x + ((I-D)/d) * (pts[i].x-pts[i-1].x)
            var qy = pts[i-1].y + ((I-D)/d) * (pts[i].y-pts[i-1].y)
            var q = {x:qx, y:qy}
            // console.log("new pt",q)
            newPoints.push(q)
            pts.splice(i, 0, q)
            D = 0.0
        } else {
            D += d
        }
    }

    // sometimes the above loop produces N-1 pts only
    if (newPoints.length === N - 1) {
        newPoints.push(pts[pts.length-1])
    }

    if(newPoints.length !== N) {
        throw "resampling error"
    }
    return newPoints
}


var isAtoZ = function(c) {
    return (c >= 'a' && c <= 'z')||(c >= 'A' && c <= 'Z')
}

var wordToPath = function (word) {
    //var lowerCaseAlphaOnly = _.filter(word, isAtoZ).join('').toLowerCase()
    //if(lowerCaseAlphaOnly.length < 1) return []
    var centerCoords = _.map(word, function(c) {return CENTERS[c]})
    var simulatedPath = resample(centerCoords)
    return simulatedPath
}

var addToDictionary = function(word) {
    //if(word in DICTIONARY) { return }
    if(Object.prototype.hasOwnProperty.call(DICTIONARY, word)) { return }
    //if(word.length === 1) { return }
    var lowerCaseAlphaOnly = _.filter(word, isAtoZ).join('').toLowerCase()
    if(lowerCaseAlphaOnly.length <= 1) { return }
    var path = wordToPath(lowerCaseAlphaOnly)
    var pathDistance = totalDistance(path)
    if(pathDistance === 0) { return }
    DICTIONARY[word] = {path: path, pathDistance: pathDistance}
}

var _getCompletionsAtLoc = {}
var startsWith = function(s, t) {
    return s.indexOf(t) == 0
}

// https://stackoverflow.com/questions/1916218/find-the-longest-common-starting-substring-in-a-set-of-strings
function sharedStart(array){
    var A= array.concat().sort(),
    a1= A[0], a2= A[A.length-1], L= a1.length, i= 0;
    while(i<L && a1.charAt(i)=== a2.charAt(i)) i++;
    return a1.substring(0, i);
}

_getCompletionsAtLoc['bash'] = function() {
    fetch('/line' + '?t=' + String(Date.now()))
        .then(function(resp) {
            return resp.json()
        })
        .then(function(json) {
            // postMessage({debug: 'line return'})
            if(json.line.indexOf(' ') > -1) {
                // postMessage({debug: 'b 1'})
                return fetch('/autocomplete' + '?t=' + String(Date.now()))
                    .then(function(resp) {
                        return resp.json()
                    })
                    .then(function(json2) {
                        // var prefix = json.line.slice(0, json.point)
                        if(json2.data.length > 1) {
                            var prefix = sharedStart(json2.data)
                            var reupdateCompleter = true
                        } else if(json2.data.length === 0) {
                            prefix = ''
                        } else { // only one
                            // look for white space before point
                            var lastSpacePos = json.line.slice(0, json.point).lastIndexOf(' ')
                            if(lastSpacePos > -1) {
                                prefix = json.line.slice(lastSpacePos+1, json.point)
                                var reupdateCompleter = true
                            } else {
                                prefix = ''
                            }
                        }
                        console.log("prefix 2", prefix)
                        var data = {
                            completions: json2.data,
                            prefix: prefix,
                            reupdateCompleter: reupdateCompleter,
                            addSpaceAtEnd: false,
                        }
                        postMessage({data: data})

                    })
            } else {
                var prefix = json.line.toLowerCase().slice(0, json.point)
                // postMessage({debug: 'b 2'})
                console.log('prefix:', prefix)
                // default completions, commonly used commands
                var completions = ['ls', 'cd', 'cat', 'cp', 'mv', 'pwd', 'mkdir', 'find', 'grep', 'rm', 'rmdir' ]
                var reupdateCompleter = true
                var addSpaceAtEnd = true
                if(prefix.length > 0) {
                    completions = _.filter(reservedWords['bash'], function(word){
                        return startsWith(word, prefix) && word !== prefix
                    })
                    reupdateCompleter = false
                    addSpaceAtEnd = false
                }
                var data = {
                    completions: completions,
                    prefix: prefix,
                    reupdateCompleter: reupdateCompleter,
                    addSpaceAtEnd: addSpaceAtEnd,
                }
                // postMessage({debug: 'b 3' + prefix})

                postMessage({data: data})
            }
        })
        .catch(function(err) {
            console.error(err)
            postMessage({err: err.message})
        })
}

var getCompletionsAtLoc = function(file, loc, mode) {
    _getCompletionsAtLoc['bash']()
}

var getSearchSpace = function(completions, mode) {
    //var rw = reservedWords[mode] || []
    return _(/*rw.concat*/(completions))
              .filter(function(word) { return word.length > 1 && Object.prototype.hasOwnProperty.call(DICTIONARY, word)})
              .map(function (word) {
                    return {
                        word: word,
                        path: DICTIONARY[word].path,
                        pathDistance: DICTIONARY[word].pathDistance
                    }
              }).value()
}


function getNearestCenter(pt) {
    var dists = _.mapValues(CENTERS, function(v) { return dist(pt, v) })
    dists = _.pairs(dists)
    return _.min(dists, '1')[0]
}

var getSuggestions = function(inputpath, completions, mode) {
    var diff = function(g1, g2) {
        if(!g1 || !g2 || g1.length !== g2.length) {
            //error state...
            //return 99999
            throw "diff error"
        }
        // var S = 0.33 * dist(g1[0], g2[0]) // first point lower score // TODO: normalize it
        var S = 0
        for(var i = 0; i < g1.length; i++){
            S += dist(g1[i], g2[i])
        }
        return S
    }

    // var normalisedInputPath = normalise(inputpath)
    // inputpath[0] = _.clone(CENTERS[getNearestCenter(inputpath[0])], true)
    inputpath = resample(inputpath)
    // inputpath[inputpath.length - 1] = _.clone(CENTERS[getNearestCenter(inputpath[inputpath.length - 1])], true)
    var inputpathDistance = totalDistance(inputpath)
    // console.log('inputpath: ', inputpath)

    // if the whole path length is only a single character
    // output the character instead

    completions.forEach(addToDictionary)

    var searchSpace = getSearchSpace(completions, mode)

    var output = _.map(searchSpace, function(entry){
        var scoreFullPath = diff(inputpath, entry.path)

        //partial path compare
        var portion = inputpathDistance / entry.pathDistance
        var nth = Math.floor(N*portion)
        var scorePartialPath = 99999 //INF
        if(nth > 0 && nth < N) {
            // var nth = Math.round(N*portion)
            var partialPath = entry.path.slice(0, nth)
            // interpolate
            var rem = N*portion - nth
            partialPath.push({
                x: entry.path[nth-1].x * (1-rem) + entry.path[nth].x * rem,
                y: entry.path[nth-1].y * (1-rem) + entry.path[nth].y * rem,
            })

            partialPath = resample(partialPath)
            scorePartialPath = diff(inputpath, partialPath) + (1-portion) /*/ portion*/
        }

        var score = Math.min(scorePartialPath, scoreFullPath)

        return {
            word: entry.word,
            score: score,
            path: entry.path,
            score_full: scoreFullPath,
            score_partial: scorePartialPath,
            portion: portion
        }
    })

    var r = _.sortBy(output, 'score')
    r = r.slice(0, NBest)
    // console.table(r)
    postMessage( {data: r} )
}

var getCompletions = function() {
    //search all the keywords
    //var charsBefore = getCharsBefore(file, loc)
    //var data = {completions: _.filter(dict, function(word){
        //// return word.startsWith(charsBefore)
        //return startsWith(word, charsBefore) && word !== charsBefore
    //}),
    //start: {line: loc.line, ch: loc.ch - charsBefore.length},
    //end: loc}

    postMessage({
        data: {
            completions: reservedWords['bash'],
        }
    })
}

var startListening = function() {
    self.onmessage = function(e) {
        var msg = e.data
        switch(msg.fn) {
            case "getSuggestions":
                getSuggestions.apply(self, msg.args)
                break
            case "getCompletionsAtLoc":
                getCompletionsAtLoc.apply(self, msg.args)
                break
            case "getCompletions":
                getCompletions.apply(self, msg.args)
                break
            default:
                break
        }
    }
}


var initializeBash = function(cb) {
    var st = Date.now()
    fetch('/compgen')
        .then(function(resp) {
            return resp.json()
        })
        .then(function(json) {
            reservedWords['bash'] = _(json.data).sort().uniq().value()
            reservedWords['bash'].forEach(addToDictionary)

            cb()
        })
        .catch(function(err) {
            console.error(err)
        })
}

var initialize = function() {
    // postMessage({debug: 'initialize'})
    //var st = Date.now()
    initializeBash(startListening)
    // startListening()
    //console.log(Date.now() - st)
    // postMessage({debug: Date.now() - st})
}

initialize()
