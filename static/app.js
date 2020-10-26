var map; // Global declaration of the map
var iw = new google.maps.InfoWindow(); // Global declaration of the infowindow
var lat_longs = new Array();
var markers = new Array();
var drawingManager;

function initialize() {
    var myLatlng = new google.maps.LatLng(40.9403762, -74.1318096);
    // var myOptions = {
    //          zoom: 13,
    //          center: myLatlng,
    //          mapTypeId: google.maps.MapTypeId.HYBRID
    // };
    let myOptions = getMapOptions();
    map = new google.maps.Map(document.getElementById("map-canvas"), myOptions);
    drawingManager = new google.maps.drawing.DrawingManager({
        // drawingMode: google.maps.drawing.OverlayType.POLYGON,
        drawingControl: true,
        drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            // drawingModes: [google.maps.drawing.OverlayType.POLYGON]
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
            draggable: true,
        },
        circleOptions: {
            draggable: true,
        }
        
    });
    drawingManager.setMap(map);

    // google.maps.event.addListener(drawingManager, "overlaycomplete", function(event) {
    //          var newShape = event.overlay;
    //          newShape.type = event.type;
    // });

    // google.maps.event.addListener(drawingManager, "overlaycomplete", function(event) {
    //          overlayClickListener(event.overlay);
    //          $('#vertices').val(event.overlay.getPath().getArray());
    // });
}

function overlayClickListener(overlay) {
    google.maps.event.addListener(overlay, "mouseup", function(event) {
        $('#vertices').val(overlay.getPath().getArray());
    });
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

function choose_location_handler() {
    console.log("CLH this", this);

    $(this).click(() => {
        $parent = $(this).parent();
        lat = $parent.find("[name='lat']");
        long = $parent.find("[name='long']");
        label = $parent.find("legend").text();
        console.log(lat, long, label);
        let fill_lat_long = (marker) => {
            lat.val(marker.position.lat);
            long.val(marker.position.lng);
        };

        drawingManager.setDrawingMode('marker');
        google.maps.event.addListenerOnce(drawingManager, 'markercomplete', marker => {
            fill_lat_long(marker);
            google.maps.event.addListenerOnce(marker, 'rightclick', () => {
                marker.setMap(null);
            });
            google.maps.event.addListener(marker, 'dragend', () => {
                fill_lat_long(marker);
            });
            drawingManager.setDrawingMode(null);
        });
    });
}

window.nofly_circle_counter = 0;
function new_nofly_circle() {
    let the_circle = null;
    let my_counter = ++window.nofly_circle_counter;
    let element_id = "nofly-circle-" + my_counter;
    let sel = "#" + element_id;
    let circle_from_text = function() {
        $el = $(sel);
        the_circle.setCenter(
            new google.maps.LatLng(
                parseFloat($el.find("[name='lat']").val()),
                parseFloat($el.find("[name='long']").val())));
        the_circle.setRadius(
            parseFloat($el.find("[name='radius']").val()));
    };
    let text_from_circle = function() {
        $el = $(sel);
        $el.find("[name='lat']").val(the_circle.getCenter().lat());
        $el.find("[name='long']").val(the_circle.getCenter().lng());
        $el.find("[name='radius']").val(the_circle.getRadius());
    };
    let remove_circle = () => {
        the_circle.setMap(null);
        $('#' + element_id).remove();
    };

    drawingManager.setDrawingMode('circle');
    google.maps.event.addListenerOnce(drawingManager, 'circlecomplete', circle => {
        the_circle = circle;
        text_from_circle();
        google.maps.event.addListenerOnce(circle, 'rightclick', remove_circle);
        google.maps.event.addListener(circle, 'dragend', text_from_circle);
        drawingManager.setDrawingMode(null);
    });

    return $('<fieldset>')
        .attr('id', element_id)
        .append($('<legend>Circle # ' + my_counter + '</legend>'))
        .append($('<input name="lat" data-type="float" placeholder="Latitude">').click(circle_from_text).change(circle_from_text))
        .append($('<input name="long" data-type="float" placeholder="Longitude">').click(circle_from_text).change(circle_from_text))
        .append($('<input name="radius" data-type="float" placeholder="Radius">').click(circle_from_text).change(circle_from_text))
        .append($('<input type="button" value="Remove">').click(remove_circle));
}

function nofly_rect_handler() {
    $(this).click(() => {
        $parent = $(this).parent();

        drawingManager.setDrawingMode('rectangle');
        google.maps.event.addListenerOnce(drawingManager, 'rectanglecomplete', rect => {
            let fill_form = (r) => {
                $parent.find("[name='ne_lat']").val(r.getBounds().getNorthEast().lat());
                $parent.find("[name='ne_long']").val(r.getBounds().getNorthEast().lng());
                $parent.find("[name='sw_lat']").val(r.getBounds().getSouthWest().lat());
                $parent.find("[name='sw_long']").val(r.getBounds().getSouthWest().lng());
            };
            fill_form(rect);
            google.maps.event.addListenerOnce(rect, 'rightclick', () => {
                rect.setMap(null);
                $parent.remove();
            });
            google.maps.event.addListener(rect, 'dragend', (eee) => {
                fill_form(rect);
            });
            drawingManager.setDrawingMode(null);
        });
    });
}

window.nofly_rect_counter = 0;
function new_nofly_rect() {
    let the_rect = null;
    let my_counter = ++window.nofly_rect_counter;
    let element_id = "nofly-rect-" + my_counter;
    let sel = "#" + element_id;
    let from_text = function() {
        $el = $(sel);
        the_rect.setBounds(new google.maps.LatLngBounds(
            new google.maps.LatLng(
                parseFloat($el.find("[name='sw_lat']").val()),
                parseFloat($el.find("[name='sw_long']").val()),
            ),
            new google.maps.LatLng(
                parseFloat($el.find("[name='ne_lat']").val()),
                parseFloat($el.find("[name='ne_long']").val()),
            ),
        ));
    };
    let from_map = function() {
        $el = $(sel);
        let ne = the_rect.getBounds().getNorthEast(),
            sw = the_rect.getBounds().getSouthWest();
        $el.find("[name='ne_lat']").val(ne.lat());
        $el.find("[name='ne_long']").val(ne.lng());
        $el.find("[name='sw_lat']").val(sw.lat());
        $el.find("[name='sw_long']").val(sw.lng());
    };
    let remove_rect = () => {
        the_rect.setMap(null);
        $(sel).remove();
    };

    drawingManager.setDrawingMode('rectangle');
    google.maps.event.addListenerOnce(drawingManager, 'rectanglecomplete', rect => {
        the_rect = rect;
        from_map();
        google.maps.event.addListenerOnce(rect, 'rightclick', remove_rect);
        google.maps.event.addListener(rect, 'dragend', from_map);
        drawingManager.setDrawingMode(null);
    });

    return $('<fieldset>')
        .attr('id', element_id)
        .append($('<legend>Rectangle #' + my_counter + '</legend>'))
        .append($('<input name="ne_lat" data-type="float" placeholder="NE Latitude">'))
        .append($('<input name="ne_long" data-type="float" placeholder="NE Longitude">'))
        .append($('<input name="sw_lat" data-type="float" placeholder="SW Latitude">'))
        .append($('<input name="sw_long" data-type="float" placeholder="SW Longitude">'))
        .append($('<input type="button" value="Remove">').click(remove_rect));
}

function create_triangle() {
    drawingManager.setDrawingMode('marker');
    let element_id = "tri-control";
    let sel = "#" + element_id;
    var base_center_marker = null, tri_poly = null;
    let default_rotation = 0, default_h_extent = 200, default_v_extent = 200; 

    let get_path = function(rotation, h_extent, v_extent, base_center_pos) {
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

    let set_path = function(path) {
        if (tri_poly)
            tri_poly.setPath(path);
        else {
            tri_poly = new google.maps.Polygon({
                paths: path,
                strokeColor: '#FF0000',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                // fillColor: '#FF0000',
                // fillOpacity: 0.35
            });
            tri_poly.setMap(map);
        }
    }

    let from_text = function() {
        $el = $(sel);
        tri_poly.setPath(
            get_path(
                parseFloat($el.find("[name='rotation']").val() || default_h_extent),
                parseFloat($el.find("[name='h_extent']").val() || default_h_extent),
                parseFloat($el.find("[name='v_extent']").val() || default_v_extent),
                new google.maps.LatLng(
                    parseFloat($el.find("[name='bc_lat']").val()),
                    parseFloat($el.find("[name='bc_long']").val()))));
    };

    let from_map = function() {
        $el = $(sel);
        $el.find("[name='bc_lat']").val(base_center_marker.getPosition().lat());
        $el.find("[name='bc_long']").val(base_center_marker.getPosition().lng());
        from_text();
    }

    let remove_tri = function() {
        tri_poly.setMap(null);
        base_center_marker.setMap(null);
        $(sel).replaceWith($('<div id="tri-control">'));
    }

    google.maps.event.addListenerOnce(drawingManager, 'markercomplete', marker => {
        base_center_marker = marker;

        set_path(
            get_path(
                default_rotation,
                default_h_extent,
                default_v_extent,
                base_center_marker.getPosition()));

        from_map();

        drawingManager.setDrawingMode(null);

        google.maps.event.addListenerOnce(marker, 'rightclick', remove_tri);
        google.maps.event.addListener(marker, 'dragend', from_map);
    });

    return $('<fieldset>')
        .attr('id', element_id)
        .append($('<legend>Triangle</legend>'))
        .append($('<input name="bc_lat" data-type="float" placeholder="Base center latitude">').change(from_text))
        .append($('<input name="bc_long" data-type="float" placeholder="Base center longitude">').change(from_text))
        .append($('<input name="h_extent" data-type="float" placeholder="Horizontal extent (meters)">').change(from_text))
        .append($('<input name="v_extent" data-type="float" placeholder="Vertical extent (meters)">').change(from_text))
        .append($('<input type="range" name="rotation" data-type="float" placeholder="Rotation (degrees)" min="0" value="0" max="360">').on('input', from_text))
        .append($('<input type="button" value="Remove">').click(remove_tri));
}

function offset_point(pt, meters_north, meters_east) {
    var earth = 63781370,  //radius of earth in meters
        m_lat = (1 / ((2 * Math.PI / 360) * earth)),
        m_lng = (1 / ((2 * Math.PI / 360) * earth));
    return  {lat: pt.lat() + (meters_north * m_lat),
             lng: pt.lng() + (meters_east * m_lng) / Math.cos(pt.lat() * Math.PI / 180)};
}

$(function() {
    initialize();

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

                xhr.send(JSON.stringify(fieldsetJSON({}, $('#field-info'))));
            })(_size);
        }
    });

    $('#download-zip-button').click(function() {
        $.ajax({
            type: "POST",
            url: "/register",
            data: JSON.stringify(fieldsetJSON({}, $('#field-info'))),
            dataType: 'json',
            contentType: "application/json; charset=utf-8",
            success: function(resp) {
                window.location.replace('/generate/' + resp.registered);
            }
        });
    });

    $('#add-nofly-circle-button').click(() => { new_nofly_circle().insertBefore($('#nofly-marker')); });
    $('#add-nofly-rect-button').click(() => { new_nofly_rect().insertBefore($('#nofly-marker')); });
    $('#place-triangle-button').click(() => { $('#tri-control').replaceWith(create_triangle()); });
    
    $('input.place-marker').each(choose_location_handler);

});

