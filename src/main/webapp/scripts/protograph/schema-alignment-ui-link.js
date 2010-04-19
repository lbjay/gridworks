SchemaAlignmentDialog.UILink = function(dialog, link, table, options, parentUINode) {
    this._dialog = dialog;
    this._link = link;
    this._options = options;
    this._parentUINode = parentUINode;
    
    this._tr = table.insertRow(table.rows.length);
    this._tdMain = this._tr.insertCell(0);
    this._tdToggle = this._tr.insertCell(1);
    this._tdDetails = this._tr.insertCell(2);
    
    $(this._tdMain).addClass("schema-alignment-link-main").attr("width", "250").addClass("padded");
    $(this._tdToggle).addClass("schema-alignment-link-toggle").attr("width", "1%").addClass("padded");
    $(this._tdDetails).addClass("schema-alignment-link-details").attr("width", "90%");
    
    this._collapsedDetailDiv = $('<div></div>').appendTo(this._tdDetails).addClass("padded").html("...");
    this._expandedDetailDiv = $('<div></div>').appendTo(this._tdDetails).addClass("schema-alignment-detail-container");
    var self = this;
    var show = function() {
        if (self._options.expanded) {
            self._collapsedDetailDiv.hide();
            self._expandedDetailDiv.show();
        } else {
            self._collapsedDetailDiv.show();
            self._expandedDetailDiv.hide();
        }
    };
    show();
    
    $(this._tdToggle).html("&nbsp;");
    $('<img />')
        .attr("src", this._options.expanded ? "images/expanded.png" : "images/collapsed.png")
        .appendTo(this._tdToggle)
        .click(function() {
            self._options.expanded = !self._options.expanded;
            
            $(this).attr("src", self._options.expanded ? "images/expanded.png" : "images/collapsed.png");
            
            show();
        });
    
    this._renderMain();
    this._renderDetails();
};

SchemaAlignmentDialog.UILink.prototype._renderMain = function() {
    $(this._tdMain).empty();
    
    var label = this._link.property !== null ? this._link.property.id : "property?";
    
    var self = this;
    
    $('<img />')
        .attr("title", "remove property")
        .attr("src", "images/close.png")
        .css("cursor", "pointer")
        .prependTo(this._tdMain)
        .click(function() {
            window.setTimeout(function() {
                self._parentUINode.removeLink(self);
                self._tr.parentNode.removeChild(self._tr);
                self._dialog.preview();
            }, 100);
        });
    
    var a = $('<a href="javascript:{}"></a>')
        .addClass("schema-alignment-link-tag")
        .html(label)
        .appendTo(this._tdMain)
        .click(function(evt) {
            self._startEditProperty(this);
        });
        
    $('<img />').attr("src", "images/arrow-start.png").prependTo(a);
    $('<img />').attr("src", "images/arrow-end.png").appendTo(a);
};

SchemaAlignmentDialog.UILink.prototype._renderDetails = function() {
    if (this._targetUI) {
        this._targetUI.dispose();
    }
    if (this._tableDetails) {
        this._tableDetails.remove();
    }
    
    this._tableDetails = $('<table></table>').addClass("schema-alignment-table-layout").appendTo(this._expandedDetailDiv);
    this._targetUI = new SchemaAlignmentDialog.UINode(
        this._dialog,
        this._link.target, 
        this._tableDetails[0], 
        { expanded: "links" in this._link.target && this._link.target.links.length > 0 });
};

SchemaAlignmentDialog.UILink.prototype._startEditProperty = function(elmt) {
    var sourceTypeID = this._parentUINode.getExpectedType();
    var targetTypeID = "type" in this._link.target && this._link.target.type !== null ? this._link.target.type.id : null;
    var targetTypeName = "columnName" in this._link.target ? this._link.target.columnName : null;
    
    if (sourceTypeID !== null) {
        var self = this;
        var dismissBusy = DialogSystem.showBusy();
        
        var instanceCount = 0;
        var outgoing = [];
        var incoming = [];
        
        function onDone(properties) {
            dismissBusy();
            
            self._showPropertySuggestPopup(
                elmt, 
                SchemaAlignmentDialog.UILink._rankProperties(properties, sourceTypeID, targetTypeID, targetTypeName)
            );
        }
        
        SchemaAlignmentDialog.UILink._getPropertiesOfType(
            sourceTypeID,
            onDone
        );
    } else {
        this._showPropertySuggestPopup(elmt, []);
    }
};

SchemaAlignmentDialog.UILink._rankProperties = function(properties, sourceTypeID, targetTypeID, targetTypeName) {
    var nameScorer;
    if (targetTypeName === null) {
        nameScorer = function() { return 1; };
    } else {
        var nameWords = targetTypeName.toLowerCase().replace(/\W/g, ' ').replace(/\s+/g, ' ').split(" ");
        var nameScoreString = function(score, s) {
            s = s.toLowerCase().replace(/\W/g, ' ');
            
            var n = 0;
            for (var i = 0; i < nameWords.length; i++) {
                if (s.indexOf(nameWords[i]) >= 0) {
                    n++;
                }
            }
            return Math.max(score, n / nameWords.length);
        };
        var nameScoreStrings = function(score, a) {
            $.each(a, function() { score = nameScoreString(score, this); });
            return score;
        };
        
        nameScorer = function(p) {
            var score = nameScoreString(0, p.name);
            score = nameScoreStrings(score, p.alias);
            
            if ("name2" in p) {
                score = nameScoreString(score, p.name2);
                score = nameScoreStrings(score, p.alias2);
            }
            
            if ("expects" in p && p.expects !== null) {
                score = nameScoreString(score, p.expects.name);
                score = nameScoreStrings(score, p.expects.alias);
            }
            if ("expects2" in p && p.expects2 !== null) {
                score = nameScoreString(score, p.expects2.name);
                score = nameScoreStrings(score, p.expects2.alias);
            }
            
            return score;
        };
    }
    
    var typeScorer;
    if (targetTypeID === null) {
        typeScorer = function(p) { return p.weight; };
    } else {
        typeScorer = function(p) {
            return p.expects.id == targetTypeID ? 1 : p.weight;
        };
    }
    
    var suggestions = [];
    for (var i = 0; i < properties.length; i++) {
        var p = properties[i];
        p.score = p.weight * (0.5 * nameScorer(p) + 0.5 * typeScorer(p));
        
        suggestions.push(p);
    }
    
    suggestions.sort(function(a, b) { return b.score - a.score; });
    suggestions = suggestions.slice(0, 7);
    
    return suggestions;
};

SchemaAlignmentDialog.UILink._getPropertiesOfType = function(typeID, onDone) {
    var done = false;
    
    $.getJSON(
        "http://gridworks-helper.freebaseapps.com/get_properties_of_type?type=" + typeID + "&callback=?",
        null,
        function(data) {
            if (done) return;
            
            onDone(data.properties || []);
        }
    );
    
    window.setTimeout(function() {
        if (done) return;
        
        done = true;
        onDone([]);
    }, 7000); // time to give up?
};

SchemaAlignmentDialog.UILink.prototype._showPropertySuggestPopup = function(elmt, suggestions) {
    self = this;
    
    var menu = MenuSystem.createMenu().width("350px");
    
    var commitProperty = function(p) {
        window.setTimeout(function() { MenuSystem.dismissAll(); }, 100);
        
        if ("id2" in p) {
            // self._targetUI.dispose();
            self._link.property = {
                id: p.id,
                name: p.name
            };
            self._link.target = {
                nodeType: "anonymous",
                links: [{
                    property: {
                        id: p.id2,
                        name: p.name2
                    },
                    target: self._link.target
                }]
            };
            
            self._renderDetails();
        } else {
            self._link.property = {
                id: p.id,
                name: p.name
            };
        }
        self._configureTarget();
    };
    
    var divSearch;
    
    if (suggestions.length > 0) {
        divSearch = $('<div>').addClass("schema-alignment-link-menu-type-search2").html('<div>Search for a property or pick one below</div>').appendTo(menu);
        
        function createSuggestion(suggestion) {
            var menuItem = MenuSystem.createMenuItem().appendTo(menu);
            menuItem.html(suggestion.id).click(function() {
                commitProperty(suggestion);
            });
        }
        
        for (var i = 0; i < suggestions.length; i++) {
            createSuggestion(suggestions[i]);
        }
    } else {
        divSearch = $('<div>').addClass("schema-alignment-link-menu-type-search").html('<div>Search for a property</div>').appendTo(menu);
    }
    var input = $('<input />').appendTo($('<div>').appendTo(divSearch));
    
    MenuSystem.showMenu(menu, function(){});
    MenuSystem.positionMenuAboveBelow(menu, $(elmt));
    
    var suggestOptions = {
        type : '/type/property'
    };
    if (this._link.target !== null && "type" in this._link.target && this._link.target.type !== null) {
        /*
        suggestOptions.mql_filter = [{
            "/type/property/expected_type" : {
                id: this._link.target.type.id
            }
        }];
        */
    } else {
        var sourceTypeID = this._parentUINode.getExpectedType();
        if (sourceTypeID !== null) {
            suggestOptions.schema = sourceTypeID;
        }
    }
    input.suggestP(suggestOptions).bind("fb-select", function(e, data) { commitProperty(data); });
    
    input[0].focus();
};

SchemaAlignmentDialog.UILink.prototype.getJSON = function() {
    if ("property" in this._link && this._link.property !== null &&
        "target" in this._link && this._link.target !== null) {
        
        var targetJSON = this._targetUI.getJSON();
        if (targetJSON !== null) {
            return {
                property: cloneDeep(this._link.property),
                target: targetJSON
            };
        }
    }
    return null;
};

SchemaAlignmentDialog.UILink.prototype._configureTarget = function() {
    var self = this;
    var dismissBusy = DialogSystem.showBusy();
    
    $.getJSON(
        "http://api.freebase.com/api/service/mqlread?query=" + JSON.stringify({
            query: {
                "id" : this._link.property.id,
                "type" : "/type/property",
                "expected_type" : {
                    "id" : null,
                    "name" : null,
                    "/freebase/type_hints/mediator" : null
                }
            }
        }) + "&callback=?",
        null,
        function(o) {
            dismissBusy();
            
            if ("result" in o) {
                var expected_type = o.result.expected_type;
                self._link.target.type = {
                    id: expected_type.id,
                    name: expected_type.name
                };
                if (expected_type["/freebase/type_hints/mediator"] === true) {
                    self._link.target.nodeType = "anonymous";
                } else if (expected_type.id == "/type/key") {
                    self._link.target.nodeType = "cell-as-key";
                } else if (expected_type.id.match(/^\/type\//)) {
                    self._link.target.nodeType = "cell-as-value";
                } else if (!("topic" in self._link.target)) {
                    self._link.target.nodeType = "cell-as-topic";
                    self._link.target.createForNoReconMatch = true;
                }
                
                self._targetUI.render();
            }
            
            self._renderMain();
            self._dialog.preview();
        },
        "jsonp"
    );
};
