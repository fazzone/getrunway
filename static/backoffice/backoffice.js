function download_file(url) {
    console.log(url);
    window.open(url, '_blank');
}

function show_app_detail(app_id) {
    $.ajax({
        type: "GET",
        url: "/app/" + app_id,
        dataType: 'json',
        success: function(resp) {
            console.log(resp);
            $('#app-detail').append($('<pre>').text(JSON.stringify(resp)));
            let $fs = $('<fieldset class="vflex">').append($('<legend>').text("Application"));
            for (const lang of Object.keys(resp.name)) {
                $fs.append($('<div class="hflex">')
                           .append($('<label>').text('Language').append($('<input>').val(lang)))
                           .append($('<label>').text('Name').append($('<input>').val(resp.name[lang]))))
            }
            for (const lang of Object.keys(resp.description)) {
                $fs.append($('<div class="hflex">')
                           .append($('<label>').text('Language').append($('<input>').val(lang)))
                           .append($('<label>').text('Description').append($('<input>').val(resp.description[lang]))))
            }

            $fs
                .append($('<label>').text('id').append($('<input disabled>').val(resp.application.id)))
                .append($('<label>').text('author').append($('<input>').val(resp.application.author)))
                .append($('<label>').text('version').append($('<input>').val(resp.application.version)))
                .append($('<label>').text('previewIcon').append($('<input>').val(resp.application.previewIcon)))
                .append($('<label>').text('releaseDate').append($('<input disabled>').val(resp.application.releaseDate)));

            let $ths = $('<tr>').append($('<th scope="col">').text('actions'));
            let file_keys = ['id','destination', 'blob_id', 'size', 'hash', 'inserted_at'];
            for (const c of file_keys) {
                $ths.append($('<th scope="col">').text(c))
            }

            let $tbody = $('<tbody>');
            for (const f of resp.files) {
                let $tr = $('<tr>')
                    .append($('<td class="hflex">')
                            .append($('<input type="button" class="table-button" value="Open">')
                                    .click(() => download_file('/file/'+f.id))
                                   )
                            .append(
                                $('<details>')
                                    .append($('<summary>').text("Replace"))
                                    .append($('<form method="post" action="replace_file" enctype="multipart/form-data">')
                                            .append($('<input name="file" type="file">'))
                                            .append($('<input name="app_id" type="hidden">').val(app_id))
                                            .append($('<input name="file_id" type="hidden">').val(f.id))
                                            .append($('<input name="destination" type="hidden">').val(f.destination))
                                            .append($('<input type="submit" value="replace">')))));
                for (const k of file_keys) {
                    $tr.append($('<td>').text(f[k]));
                }
                $tbody.append($tr);
            }
            $('#app-detail').empty()
                .append($('<form>').append($fs))
                .append($('<table>')
                        .append($('<thead>').append($ths))
                        .append($tbody)
                       );
        }});
}

function update_templates(data) {
    $.ajax({
        type: "POST",
        url: "templates",
        data: JSON.stringify(data),
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        success: function(resp) {
            $('#templates-error')
                .empty()
                .append($('<p>').text("Updated templates"))
        },
        error: function(e, a, b) {
            $('#templates-error')
                .empty()
                .append($('<p>').text("Error updating templates"))
                .append($('<pre>').text(e.responseText));

        }
    });
}

$(function() {
    $.ajax({
        type: "GET",
        url: "templates",
        dataType: 'json',
        success: function(resp) {
            let $ths = $('<tr>')
                .append($('<th scope="col">').text('Template type'))
                .append($('<th scope="col">').text('Application ID'));
            let $tbody = $('<tbody>');
            var table_inputs = [];
            for (var r  of resp) {
                $tbody.append($('<tr>')
                              .append($('<td>').append(r.$template_type = $('<input>').val(r['template_type'])))
                              .append($('<td>').append(r.$application_id = $('<input>').val(r['application_id']))));
            }

            $('#templates-container')
                .empty()
                .append($('<table>')
                        .append($('<thead>').append($ths))
                        .append($tbody)
                       )
                .append($('<input type="button" value="Update templates">')
                        .click(function() {
                            $('#templates-error').empty();
                            var req = {};
                            for (const r of resp) req[r.$template_type.val()] = parseInt(r.$application_id.val());
                            update_templates(req);
                        })
                       );
        }
    });
    $.ajax({
        type: "GET",
        url: "all_apps",
        dataType: 'json',
        success: function(resp) {
            let keys = Object.keys(resp[0]);
            let $ths = $('<tr>').append($('<th scope="col">').text('Select'));
            let $tbody = $('<tbody>');
            for (k of keys) {
                $ths.append($('<th scope="col">').text(k));
            }
            for (r of resp) {
                let $tr = $('<tr>')
                    .append($('<td>')
                            .append($('<input type="button" class="table-button" value="Select">').click(() => show_app_detail(r.id))));
                for (k of keys) {
                    $tr.append($('<td>').text(r[k]));
                }
                $tbody.append($tr);
            }

            $('#apps-table-container')
                .empty()
                .append($('<table>')
                        .append($('<thead>').append($ths))
                        .append($tbody)
                       );
        }
    });

});
