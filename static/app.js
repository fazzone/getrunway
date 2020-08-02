var map; // Global declaration of the map
var iw = new google.maps.InfoWindow(); // Global declaration of the infowindow
var lat_longs = new Array();
var markers = new Array();
var drawingManager;

function initialize() {
    var myLatlng = new google.maps.LatLng(40.9403762, -74.1318096);
    // var myOptions = {
    // 	zoom: 13,
    // 	center: myLatlng,
    // 	mapTypeId: google.maps.MapTypeId.HYBRID
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
	// polygonOptions: {
	//     editable: true
	// }
	drawingMode: null,
	markerOptions: {
	    draggable: true,
	}
    });
    drawingManager.setMap(map);

    // google.maps.event.addListener(drawingManager, "overlaycomplete", function(event) {
    // 	var newShape = event.overlay;
    // 	newShape.type = event.type;
    // });

    // google.maps.event.addListener(drawingManager, "overlaycomplete", function(event) {
    // 	overlayClickListener(event.overlay);
    // 	$('#vertices').val(event.overlay.getPath().getArray());
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
    
    $fs.find('> fieldset').each(function() {
        console.log("Recur ", this);
        acc[this.dataset.name] = fieldsetJSON({}, $(this));
    });

    return acc;
}

$(function() {
    initialize();

    $('#select-map-type').change(function() {
	map.setMapTypeId($('#select-map-type').val());
    });

    $('#submit-fields-info').click(function() {
        console.log("What the fuck jquery");
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


    $('input.place-marker').each(function() {
	lat = $(this).parent().find("[name='lat']");
	long = $(this).parent().find("[name='long']");
	label = $(this).parent().find("legend").text();
	let fill_lat_long = (marker) => {
		lat.val(marker.position.lat);
		long.val(marker.position.lng);
	};

	$(this).click(() => {
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
    });

});

