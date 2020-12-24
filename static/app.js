var map; // Global declaration of the map
var drawingManager;
var MAP_OBJECTS = new Array();

function initialize() {
    var myLatlng = new google.maps.LatLng(40.9403762, -74.1318096);
    let myOptions = getMapOptions();
    map = new google.maps.Map(document.getElementById("map-canvas"), myOptions);
    drawingManager = new google.maps.drawing.DrawingManager({
        drawingControl: true,
        drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: [
                google.maps.drawing.OverlayType.MARKER,
                // google.maps.drawing.OverlayType.RECTANGLE,
                google.maps.drawing.OverlayType.CIRCLE,
                google.maps.drawing.OverlayType.POLYGON
            ]
        },
        polygonOptions: {
            editable: true,
            draggable: true,
        },
        drawingMode: null,
        markerOptions: {
            draggable: true,
        },
        rectangleOptions: {
            editable: true,
            draggable: true,
        },
        circleOptions: {
            draggable: true,
        }
        
    });
    drawingManager.setMap(map);

    google.maps.event.addListener(drawingManager, "overlaycomplete", function(event) {
        var m_obj = {overlay: event.overlay, type: event.type};
        if (event.type == 'circle') {
            $('#fs-overlays').append(on_circle_complete(m_obj));
        } else if (event.type == 'rectangle') {
            $('#fs-overlays').append(on_rect_complete(m_obj));
        } else if (event.type == 'polygon') {
            $('#fs-overlays').append(on_poly_complete(m_obj));
        } else if (event.type == 'marker') {
            let marker_type = get_type_for_new_marker();
            if (marker_type == 'runway') {
                $('#triangle-form').css('display', 'block');
                $('#runway-form')
                    .empty()
                    .append(marker_poly(m_obj, 'runway',   {title: 'Runway',   path_fn: runway_path,   length: 100, width: 10}));
            } else if (marker_type == 'triangle') {
                $('#triangle-form')
                    .empty()
                    .append(marker_poly(m_obj, 'triangle', {title: 'Triangle', path_fn: triangle_path, length: 100, width: 200}));
            } 
        }
        MAP_OBJECTS.push(m_obj);
        drawingManager.setDrawingMode(null);
    });
}

function make_json_data() {
    var runway = null,
        triangle = null;

    var nofly_circle = {inside: [], outside: []},
        nofly_rect = {inside: [], outside: []},
        nofly_poly = {inside: [], outside: []};

    var nofly = [];

    for (mobj of MAP_OBJECTS) {
        if (mobj.deleted) continue;
        if (mobj.type == 'runway') runway = mobj;
        if (mobj.type == 'triangle') triangle = mobj;
        if (mobj.type == 'circle') {
            nofly.push({
                type: 'circle',
                inside_or_outside: mobj.inside_outside,
                lat: mobj.overlay.getCenter().lat(),
                lng: mobj.overlay.getCenter().lng(),
                diameter: 2 * mobj.overlay.getRadius(),
            })
        }
        if (mobj.type == 'polygon') {
            var path = [];
            mobj.overlay.getPath().forEach((pt) => path.push({lat: pt.lat(), lng: pt.lng()}));
            nofly.push({
                type: 'polygon',
                inside_or_outside: mobj.inside_outside,
                path: path
            });
        }
        //todo rectangle?
    }

    if (runway == null) return {error: "runway data is required"};

    return {
        name: $('#input-field-name').val(),
        shortname: $('#input-field-short-name').val(),
        lat: runway.data.center.lat(),
        lng: runway.data.center.lng(),
        runway: {
            path: runway.data.path,
            heading: runway.data.heading
        },
        triangle: {
            path: triangle.data.path,
            heading: triangle.data.heading,
            center: {lat: triangle.data.center.lat(),
                     lng: triangle.data.center.lng()},

        },
        nofly: nofly,
    };
}

function get_type_for_new_marker() {
    var have_runway = false,
        have_triangle = false;
    for (mobj of MAP_OBJECTS) {
        if (mobj.deleted) continue;
        have_runway = have_runway || mobj.type == 'runway';
        have_triangle = have_triangle || mobj.type == 'triangle';
    }
    if (!have_runway) return 'runway';
    else if (!have_triangle) return 'triangle';
    else return 'marker';

}

function marker_poly(me, type, data) {
    let the_marker = me.overlay,
        my_counter = MAP_OBJECTS.length,
        element_id = "marker-runway-" + my_counter,
        sel = "#" + element_id;

    me.type = type;
    me.data = data;
    me.data.center = the_marker.getPosition();

    var the_poly = new google.maps.Polygon({
        map: map,
        strokeOpacity: 0.8,
        strokeWeight: 2,
    });

    let remove_marker = () => {
        me.deleted = true;
        the_marker.setMap(null);
        the_poly.setMap(null);
        $(sel).remove();
    };

    let set_path = function() {
        let r = me.data;
        let path = me.data.path_fn(r.heading, r.length, r.width, r.center);
        the_poly.setPath(me.data.path = path);
    }

    let from_text = function($el) {
        me.data.length = parseFloat($el.find("[name='length']").val());
        me.data.width = parseFloat($el.find("[name='width']").val());
        me.data.heading = parseFloat($el.find("[name='heading']").val());
        set_path();
        return $el;
    }

    google.maps.event.addListener(the_marker, 'rightclick', function() {
        remove_marker();
    });
    google.maps.event.addListener(the_marker, 'drag', function() {
        me.data.center = the_marker.getPosition();
        set_path();
    });

    return from_text(
        $('<fieldset>')
            .attr('id', element_id)
            .append($('<legend>').text(me.data.title))
            .append($('<div class="runway-data" data-visible="false" style="display: block;">')
                    .append($('<label>')
                            .append("Length (meters)")
                            .append($('<input name="length">')
                                    .val(me.data.length)
                                    .on('input', () => from_text($(sel)))))
                    .append($('<label>')
                            .append("Width (meters)")
                            .append($('<input name="width">')
                                    .val(me.data.width)
                                    .on('input', () => from_text($(sel)))))
                    .append($('<label>')
                            .append('Heading: ')
                            .append('<span class="text-heading">0</span>')
                            .append($('<input type="range" name="heading" min="0" value="0" max="360">')
                                    .on('input', function() {
                                        $(sel).find(".text-heading").text($(this).val());
                                        window.requestAnimationFrame(() => from_text($(sel)));
                                    }))))
            .append($('<input type="button" class="remove-button" value="Remove">').click(remove_marker)));
}

function on_poly_complete(me) {
    let the_poly = me.overlay;
    let my_counter = MAP_OBJECTS.length;
    let element_id = "nofly-rect-" + my_counter;
    let sel = "#" + element_id;

    let remove_poly = () => {
        me.deleted = true;
        the_poly.setMap(null);
        $(sel).remove();
    };

    google.maps.event.addListener(the_poly, 'rightclick', function() {
        remove_poly();
    });

    return $('<fieldset>')
        .attr('id', element_id)
        .append($('<legend>Polygon #' + my_counter + '</legend>'))
        .append($('<div style="display: flex;">')
                .append(select_inside_outside(me))
                .append($('<input type="button" class="remove-button" value="Remove">').click(remove_poly)));
}

function on_rect_complete(me) {
    let the_rect = me.overlay;
    let my_counter = MAP_OBJECTS.length;
    let element_id = "nofly-rect-" + my_counter;
    let sel = "#" + element_id;
    let from_text = function() {
        $el = $(sel);
        the_rect.setBounds(new google.maps.LatLngBounds(
            new google.maps.LatLng(
                parseFloat($el.find("[name='sw_lat']").val()),
                parseFloat($el.find("[name='sw_lng']").val()),
            ),
            new google.maps.LatLng(
                parseFloat($el.find("[name='ne_lat']").val()),
                parseFloat($el.find("[name='ne_lng']").val()),
            ),
        ));
    };
    let from_map = function($el) {
        let ne = the_rect.getBounds().getNorthEast(),
            sw = the_rect.getBounds().getSouthWest();
        $el.find("[name='ne_lat']").val(ne.lat());
        $el.find("[name='ne_lng']").val(ne.lng());
        $el.find("[name='sw_lat']").val(sw.lat());
        $el.find("[name='sw_lng']").val(sw.lng());
        return $el;
    };
    let remove_rect = () => {
        me.deleted = true;
        the_rect.setMap(null);
        $(sel).remove();
    };

    let on_update = () => window.requestAnimationFrame(() => from_map($(sel)));
    google.maps.event.addListener(the_rect, 'drag', on_update);
    google.maps.event.addListener(the_rect, 'bounds_changed', on_update);
    google.maps.event.addListener(the_rect, 'rightclick', function() {
        remove_rect();
    });

    return from_map(
        $('<fieldset>')
            .attr('id', element_id)
            .append($('<legend>Rectangle #' + my_counter + '</legend>'))
            .append($('<div data-visible="false" style="display: none;">')
                    .append($('<input name="ne_lat" data-type="float" placeholder="NE Latitude">'))
                    .append($('<input name="ne_lng" data-type="float" placeholder="NE Longitude">'))
                    .append($('<input name="sw_lat" data-type="float" placeholder="SW Latitude">'))
                    .append($('<input name="sw_lng" data-type="float" placeholder="SW Longitude">')))
            .append($('<div style="display: flex;">')
                    .append(select_inside_outside(me))
                    .append($('<input type="button" class="remove-button" value="Remove">').click(remove_rect))));
}

function select_inside_outside(me) {
    let default_val = "inside",
        fill_color_map = {outside: "#43973c", inside: "#773030"};
    me.inside_outside = default_val;
    me.overlay.setOptions({fillColor: fill_color_map[default_val]});
    return $('<select value="' + default_val + '">')
        .append($('<option value="inside">').text('No-Fly Inside'))
        .append($('<option value="outside">').text('No-Fly Outside'))
        .change(function() {
            let v = $(this).val();
            me.inside_outside = v;
            me.overlay.setOptions({fillColor: fill_color_map[v]});
        });
}

function on_circle_complete(me) {
    console.log("OCC");

    let the_circle = me.overlay,
        my_counter = MAP_OBJECTS.length,
        element_id = "circle-" + my_counter,
        sel = "#" + element_id;

    let circle_from_text = function() {
        $el = $(sel);
        let lat = parseFloat($el.find("[name='lat']").val()),
            lng = parseFloat($el.find("[name='lng']").val()),
            r   = parseFloat($el.find("[name='radius']").val());
        the_circle.setCenter(new google.maps.LatLng(lat, lng))
        the_circle.setRadius(r);
    };
    let r_fmt = Intl.NumberFormat(undefined,{maximumFractionDigits: 1});
    let text_from_circle = function($el) {
        let lat = the_circle.getCenter().lat(),
            lng = the_circle.getCenter().lng(),
            r   = the_circle.getRadius();
        $el.find(".val-lat").val(lat)
        $el.find(".val-lng").val(lng)
        $el.find(".val-radius").val(r);
        $el.find(".text-radius").text(r_fmt.format(r));
        return $el;
    };
    let remove_circle = () => {
        me.deleted = true;
        the_circle.setMap(null);
        $('#' + element_id).remove();
    };
    google.maps.event.addListener(the_circle, 'drag', function() {
        window.requestAnimationFrame(() => text_from_circle($(sel)));
    });
    google.maps.event.addListener(the_circle, 'rightclick', function() {
        remove_circle();
    });

    let original_radius = the_circle.getRadius();
    
    return text_from_circle(
        $('<fieldset>')
            .attr('id', element_id)
            .append($('<legend>Circle #' + my_counter + '</legend>'))
            .append($('<div data-visible="false" style="display: none;">')
                    .append($('<input name="lat" class="val-lat" data-type="float" placeholder="Latitude">').click(circle_from_text).change(circle_from_text))
                    .append($('<input name="lng" class="val-lng" data-type="float" placeholder="Longitude">').click(circle_from_text).change(circle_from_text))
                    .append($('<input name="radius" class="val-radius" data-type="float" placeholder="Radius">').click(circle_from_text).change(circle_from_text)))
            .append($('<label>')
                    .append('Radius: <span class="text-radius"></span> meters')
                    .append($('<input type="range" class="adjust-radius" min="0" value="100" max="200">')
                            .on('input', function() {
                                window.requestAnimationFrame(function () {
                                    let $el = $(sel),
                                        adjust = $el.find(".adjust-radius").val() / 100.0;
                                    the_circle.setRadius(original_radius * adjust);
                                    text_from_circle($el);
                                });
                            })))
            .append($('<div style="display: flex;">')
                    .append(select_inside_outside(me))
                    .append($('<input type="button" class="remove-button" value="Remove">').click(remove_circle))));
}

function getMapOptions() {
    return {
        zoom: 17,
        center: new google.maps.LatLng(39.147398, -77.337639),
        mapTypeId: $('#select-map-type').val(),
        rotateControl: true
    };
}

function jsonValue(input) {
    switch (input.dataset.type) {
    case 'float': return parseFloat(input.value);
    default: return input.value;
    }
}

function fieldsetJSON(acc, $fs) {
    $fs.find('> input').each(function() {
        acc[this.name] = jsonValue(this);
    });

    if ($fs.data('type') == "repeated") {
        return $fs.find('> fieldset').map(function() {
            return fieldsetJSON({}, $(this));
        }).get();
    } else {
        $fs.find('> fieldset').each(function() {
            acc[this.dataset.name] = fieldsetJSON({}, $(this));
        });
        return acc;
    }
}

function offset_point(pt, meters_north, meters_east) {
    let earth = 6378137,  //radius of earth in meters
        m_lat = (1 / ((2 * Math.PI / 360) * earth)),
        m_lng = (1 / ((2 * Math.PI / 360) * earth));
    return  {lat: pt.lat() + (meters_north * m_lat),
             lng: pt.lng() + (meters_east * m_lng) / Math.cos(pt.lat() * Math.PI / 180)};
}

function triangle_path(rotation, h_extent, v_extent, base_center_pos) {
    let theta = rotation * Math.PI / 180,
        vy = v_extent * Math.sin(theta),
        vx = v_extent * Math.cos(theta),
        hy = h_extent * Math.sin(theta + Math.PI/2),
        hx = h_extent * Math.cos(theta + Math.PI/2);

    return [
        offset_point(base_center_pos, vx, vy),
        offset_point(base_center_pos, hx, hy),
        offset_point(base_center_pos, -hx, -hy),
    ]
}

function runway_path(rotation, length, width, center_pos) {
    let theta = rotation * Math.PI / 180,
        vy = length * Math.sin(theta),
        vx = length * Math.cos(theta),
        hy = width * Math.sin(theta + Math.PI/2),
        hx = width * Math.cos(theta + Math.PI/2);
    
    return [
        offset_point(center_pos, vx-hx, vy-hy), //top left
        offset_point(center_pos, vx+hx, vy+hy), //top right
        offset_point(center_pos, hx-vx, hy-vy), //bottom right
        offset_point(center_pos, -hx-vx, -hy-vy), //bottom left
    ];
}

$(function() {
    initialize();

    $('#btn-edit-field-name').click(function() {
        $(this).css('display', 'none');
        $('#btn-done-edit-field-name').css('display', 'block');
        $('#fs-edit-field-name').data('visible', "true").css('display', 'block')
    });
    $('#btn-done-edit-field-name').click(function() {
        $(this).css('display', 'none');
        $('#btn-edit-field-name').css('display', 'unset');
        $('#fs-edit-field-name').data('visible', "false").css('display', 'none');
    })
    $('#sp-field-name').text($('#input-field-name').val());
    $('#input-field-name').on('input', function () {
        $('#sp-field-name').text($(this).val());
    });
    $('#sp-field-short-name').text($('#input-field-short-name').val());
    $('#input-field-short-name').on('input', function () {
        $('#sp-field-short-name').text($(this).val());
    });


    $('#select-map-type').change(function() {
        map.setMapTypeId($('#select-map-type').val());
    });

    $('#preview-button').click(function() {
        for (_size of [250, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]) {
            (function(size) {
                var xhr = new XMLHttpRequest();
                xhr.open("POST", "/fancy/" + size, true);
                xhr.responseType = "arraybuffer";
                xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                xhr.onload = function(e) {
                    console.log("Begin load", size);
                    var arrayBufferView = new Uint8Array(this.response);
                    var blob = new Blob([arrayBufferView], {type: "image/png"});
                    var urlCreator = window.URL || window.webkitURL;
                    var imageUrl = urlCreator.createObjectURL(blob);

                    let $el = $('<div class="field-image vflex">')
                        .data('size', size)
                        .append($("<div>", {style: "margin: auto;"})
                                .append(size + " meters"))
                        .append($('<img>', {src: imageUrl}))

                    var inserted = false;
                    $("#images-preview")
                        .children()
                        .each(function () {
                            let ch_size = parseInt($(this).data('size'));
                            console.log("Compare ", ch_size, size);
                            if (ch_size == size) {
                                $(this).replaceWith($el);
                            }
                            else if (!inserted && ch_size > size) {
                                inserted = true;
                                $(this).before($el);
                            }
                        });
                    console.log("First insert", size);
                    if (!inserted)
                        $("#images-preview").append($el);
                    console.log("End load", size);
                };

                //xhr.send(JSON.stringify(fieldsetJSON({}, $('#field-info'))));
                xhr.send(JSON.stringify(make_json_data()));
            })(_size);
        }
    });


    $('#create-repo-button').click(function() {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/create_repo", true);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.onload = function(e) {
            console.log("Xhronload", e);
            console.log("Response", xhr.response);
            let repo_url = xhr.response;
            $('#created-repo-url').append(
                $('<a>')
                    .text("Created repository")
                    .attr('href', xhr.response));
        };

        xhr.send(JSON.stringify(make_json_data()));
    });

    $('#button-goto-latlng').click(function() {
        map.setCenter({lat: parseFloat($('#input-goto-lat').val()),
                       lng: parseFloat($('#input-goto-lng').val())});
    });

    $('#download-json-button').click(function() {
        let $el = $('<a>')
            .attr('href', URL.createObjectURL(new Blob([JSON.stringify(make_json_data(), null, 2)])))
            .attr('download', 'fields.json');
        $el[0].click();
    });

    // $('#download-zip-button').click(function() {
    //     $.ajax({
    //         type: "POST",
    //         url: "/register",
    //         data: JSON.stringify(fieldsetJSON({}, $('#field-info'))),
    //         dataType: 'json',
    //         contentType: "application/json; charset=utf-8",
    //         success: function(resp) {
    //             window.location.replace('/generate/' + resp.registered);
    //         }
    //     });
    // });
});

