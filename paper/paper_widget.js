var paper_path = IPython.notebook.base_url + 'nbextensions/paper/paper_9_22_full';
require.config({
    paths: {
        paper: paper_path
    },
    shim: {
        paper: {
            exports: 'paper'
        },
    }
});

define(['jqueryui', 'widgets/js/manager', 'widgets/js/widget', 'paper'], function($, manager, widget, paper) {
    var cssref = $('<link/>')
        .attr('rel', 'stylesheet')
        .attr('type', 'text/css')
        .attr('href', IPython.notebook.base_url + 'nbextensions/paper/paper.css')
        .appendTo($('head'));

    var PaperModel = widget.WidgetModel.extend({
        _lib_class: null,
        _attrs: [],
        
        initialize: function() {
            PaperModel.__super__.initialize.apply(this, arguments);

            this.instance = new this._lib_class();
            var that = this;
            this._attrs.forEach(function(attr) {
                var py_attr = attr.py !== undefined ? attr.py : attr;
                var js_attr = attr.js !== undefined ? attr.js : attr;

                var update = function() {
                    that.instance[js_attr] = that.get(py_attr);
                };
                that.on('change:'+py_attr, update, that);
            });
        },
    });

    var PointModel = PaperModel.extend({
        _lib_class: paper.Point,
        _attrs: ['x', 'y'],
    });
    manager.WidgetManager.register_widget_model('PointModel', PointModel);
    
    var PathModel = PaperModel.extend({
        _lib_class: paper.Path,
        _attrs: [
            {py: 'stroke_color', js: 'strokeColor'}, 
            {py: 'stroke_width', js: 'strokeWidth'}
        ],
        _parent: null,
        
        initialize: function() {
            PathModel.__super__.initialize.apply(this, arguments);
            this._redraw_callback = null;
            
            this.on('change:points', this._points_changed, this);
            this._points_changed();

            this.on('change:closed', this._closed_changed, this);
            this._closed_changed();
        },

        redraw: function() {
            while (this.instance.segments.length > 0) {
                this.instance.removeSegment(0);
            }

            var new_value = this.get('points');
            if (new_value) {
                if (new_value.length > 1) {
                    this.instance.moveTo(new_value[0].instance);
                    for (var i = 1; i < new_value.length; i++) {
                        this.instance.lineTo(new_value[i].instance);
                    }
                }

                if (this._parent) {
                    this._parent.draw();
                }
            }
        },

        _points_changed: function() {
            this.redraw();

            if (this._redraw_callback) {
                this._redraw_callback.apply(this, [this]);
            }
        },

        _closed_changed: function() {
            this.instance.closed = this.get('closed');
        }
    });
    
    var PaperCanvas = widget.DOMWidgetView.extend({
        _editting_index: null,

        render: function() {
            PaperCanvas.__super__.render.apply(this, arguments);


            this.setElement($('<canvas/>'));
            this.listenTo(this.model, 'msg:custom', this.msg, this);

            var that = this;
            this.after_displayed(function() {
                paper.setup(that.el);
                paper.view.onFrame = function(event) {};
                $(that.el).on('mouseup', function(event) {
                    var offset = $(that.el).offset();
                    that.add_point({
                        x: event.clientX - offset.left,
                        y: event.clientY - offset.top,
                    });
                });
                that._update_paths();
                that.listenTo(that.model, 'change:paths', that._update_paths, that)
            });

            this._handles = [];
        },

        add_point: function(point, index) {
            var paths = this.model.get('paths');
            if (paths) {
                var path = paths[this._editting_index];
                if (path) {
                    var that = this;
                    this.model.widget_manager.create_model({
                        model_name: 'PointModel', 
                        widget_class: 'paper.paper.Point'})
                        .then(function(model) {
                            model.request_state(model.callbacks(that)).then(function() {
                                model.set('x', point.x);
                                model.set('y', point.y);
                                model.save_changes(model.callbacks(that));

                                var points = []
                                points = points.concat(path.get('points'));
                                if (index === undefined) {
                                    points.push(model);
                                } else {
                                    points.splice(index, 0, model);
                                }
                                path.set('points', points);
                                path.save_changes(path.callbacks(that))
                            });
                        },
                        $.proxy(console.error, console));
                }
            }
        },

        msg: function(content) {
            var that = this;
            this.after_displayed(function() {
                switch (content.type) {
                    case 'draw':
                        that.draw();
                        return;
                    case 'start_edit':
                        that.start_edit(content.index);
                        return;
                    case 'stop_edit':
                        that.stop_edit(content.index);
                        return;
                }
            });
        },

        draw: function() {
            paper.setup(this.el);
            paper.view.draw();
        },

        start_edit: function(index) {
            if (this._editting_index !== null) {
                this.stop_edit();
            }
            this._editting_index = index;
            this._redraw_callback(null);
        },

        stop_edit: function() {
            this._editting_index = null;
            this._redraw_callback(null);
        },

        _update_paths: function() {
            var paths = this.model.get('paths');
            if (paths) {
                for (var i = 0; i < paths.length; i++) {
                    paths[i]._parent_el = this.el;
                    var that = this;
                    paths[i]._redraw_callback = function(path) { 
                        that._redraw_callback(path); 
                    };
                }
            }
        },

        _redraw_callback: function(path) {
            if (path === null || path === this.model.get('paths')[this._editting_index]) {
                this._draw_handles(this.model.get('paths')[this._editting_index]);
            }
        },

        _draw_handles: function(path) {
            this._clear_handles();

            var that = this;
            if (path) {
                var canvas_position = $(this.el).position();
                for (var i = 0; i < path.get('points').length; i++) {
                    (function (i) {
                        var point = path.get('points')[i];
                        var x = point.get('x');
                        var y = point.get('y');
                        var handle = $('<div/>')
                            .addClass('shape-handle')
                            .css({
                                left: x - 5 + canvas_position.left,
                                top: y - 5 + canvas_position.top
                            })
                            .insertBefore(that.el)
                            .draggable({
                                start: function() {
                                    $('.shape-add-handle').hide();
                                },
                                drag: function() {
                                    var handle_pos = handle.position();
                                    var p = path.get('points')[i];
                                    p.set('x', handle_pos.left + 5 - canvas_position.left);
                                    p.set('y', handle_pos.top + 5 - canvas_position.top);
                                    p.save_changes(p.callbacks(that))
                                    path.redraw();
                                },
                                stop: function() {
                                    $('.shape-add-handle').show();
                                    that._draw_handles(path);
                                }
                            });
                        that._handles.push(handle);
                    
                        if (i < path.get('points').length - 1) {
                            point = path.get('points')[i+1];
                            var x2 = point.get('x');
                            var y2 = point.get('y');
                            var new_x = (x+x2)/2;
                            var new_y = (y+y2)/2;

                            var add_handle = $('<div/>')
                                .addClass('shape-add-handle')
                                .css({
                                    left: new_x - 5 + canvas_position.left,
                                    top: new_y - 5 + canvas_position.top
                                })
                                .click(function() {
                                    that.add_point({x: new_x, y: new_y}, i+1);
                                    that._draw_handles(path);
                                })
                                .insertBefore(that.el);
                            that._handles.push(add_handle);
                        }
                    })(i);
                }
            }
        },

        _clear_handles: function() {
            for (var i = 0; i < this._handles.length; i++) {
                this._handles[i].remove();
            };
        },
    });

    return {
        PaperCanvas: PaperCanvas,
        PointModel: PointModel,
        PathModel: PathModel,
    }
});