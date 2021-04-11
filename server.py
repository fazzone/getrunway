import functools
import json
import uuid
import io
import sys
import zipfile
import hashlib
import base64
from flask import Flask, request, jsonify, send_file, render_template, redirect
#from getrunway import do_field
from metricrunway import do_field
import os
import psycopg2
from psycopg2.extras import Json
app = Flask(__name__)

registered_fields = {}

class DictWrapper(dict):
    pass

## https://stackoverflow.com/a/42151923
def sha256_base64(o):
    hasher = hashlib.sha256()
    hasher.update(repr(make_hashable(o)).encode())
    return base64.b64encode(hasher.digest()).decode()

def make_hashable(o):
    if isinstance(o, (tuple, list)):
        return tuple((make_hashable(e) for e in o))

    if isinstance(o, dict):
        return tuple(sorted((k,make_hashable(v)) for k,v in o.items()))

    if isinstance(o, (set, frozenset)):
        return tuple(sorted(make_hashable(e) for e in o))

    return o

images_cache = {}
def get_images(reference):
    global images_cache
    global registered_fields
    params = registered_fields[reference]
    hd = make_hashable(params)
    print(hd)
    key = sha256_base64(hd)
    print("HASH ", repr(key))
    v = images_cache.get(key)
    if v:
        print("IT WAS CACHED")
        sys.stdout.flush()
        return v
    print("IT WAS NOT CACHED")
    sys.stdout.flush()
    images = DictWrapper(do_field(params))
    images_cache[key] = images
    return images

@app.route('/register', methods=['POST'])
def go():
    global registered_fields
    k = str(uuid.uuid4())
    
    registered_fields[k] = request.json
    print(request.json)
    sys.stdout.flush()
    images = get_images(k)
    print("Done")
    sys.stdout.flush()
    return jsonify({'registered': str(k),
                    'images': list(images.keys())})

def save_blob(cur, data):
    cur.execute('insert into blob(data) values (%s) returning id', (psycopg2.Binary(data), ))
    blob_id = cur.fetchone()[0]
    return blob_id


APP_BASE_URL = os.environ['APP_BASE_URL']

def url_for_repo(repo_id):
    return "{}/repo/{}/apps.json".format(APP_BASE_URL, repo_id)

@app.route('/repo/<repo_id>/<ignored>', methods=['GET'])
def get_repo(repo_id, ignored):
    print("Repo id " + repr(repo_id))
    cur = conn.cursor()
    # cur.execute('SELECT json from apps_json_view where repository_id = %s', (repo_id, ))
    cur.execute('select * from get_apps_json(%s, %s)', (APP_BASE_URL, repo_id))
    print("Get apps json")
    sys.stdout.flush()
    rs = cur.fetchall()
    conn.commit()
    return {'applications': [r[0] for r in rs]}


@app.route('/fancy/<image_width_m_str>', methods=['POST'])
def image_xhr(image_width_m_str):
    image_data = do_field(request.json, int(image_width_m_str))
    buf = io.BytesIO(image_data)
    buf.seek(0)
    cur = conn.cursor()
    blob_id = save_blob(cur, image_data)
    print("Saved blob " + repr(blob_id))
    conn.commit()
    return send_file(buf, mimetype = "image/png")

@app.route('/image/<uuid>/<img>', methods=['GET'])
def send_image(uuid, img):
    print("SEND IMAGE", uuid, img)
    sys.stdout.flush()
    imgs = get_images(uuid)
    bio = io.BytesIO(imgs[img])
    return send_file(bio, mimetype="image/png")
    #return send_file(bio, as_attachment=True, attachment_filename="img".format(img))
        
@app.route('/generate/<uuid>', methods=['GET'])
def generate(uuid):
    global registered_fields
    if uuid not in registered_fields:
        return 'whoops'
    image_files = get_images(uuid)
    bio = io.BytesIO()
    zf = zipfile.ZipFile(bio, "w")
    for filename, image_bytes in image_files.items():
        zf.writestr(filename, image_bytes)
    zf.close()
    bio.seek(0)
    return send_file(bio, as_attachment=True, attachment_filename="{}.zip".format(uuid))


DATABASE_URL = os.environ['DATABASE_URL']
# conn = psycopg2.connect(DATABASE_URL, sslmode='require')
conn = psycopg2.connect(DATABASE_URL)

def url_for_file(file_id):
    return "{}/file/{}".format(APP_BASE_URL, file_id)

@app.route('/file/<file_id>', methods=['GET'])
def get_file(file_id):
    cur = conn.cursor()
    cur.execute('select destination, data from file f join blob b on f.blob_id = b.id where f.id = %s', (file_id, ))
    (dest, data) = cur.fetchone()
    conn.commit()
    return send_file(io.BytesIO(data), mimetype = "application/octet-stream")

@app.route('/blob/<blob_id>', methods=['GET'])
def get_blob(blob_id):
    cur = conn.cursor()
    cur.execute('select data from blob b where b.id = %s', (blob_id, ))
    data = cur.fetchone()[0]
    conn.commit()
    return send_file(io.BytesIO(data), mimetype = "application/octet-stream")

@app.route('/app/<app_id>/description/<language>', methods=['GET'])
def get_app_description(app_id, language):
    cur = conn.cursor()
    cur.execute('select description from app_description ad where ad.application_id = %s and ad.language = %s', (app_id, language))
    d = cur.fetchone()[0]
    conn.commit()
    return d

@app.route('/app/<app_id>', methods=['GET'])
def get_app_route(app_id):
     cur = conn.cursor()
     cur.execute('select get_app(%s)', (app_id,))
     data = cur.fetchone()[0]
     conn.commit()
     return jsonify(data)

from werkzeug.utils import secure_filename

def create_application(cur, source, author, version, icon):
    cur.execute('''
    insert into application(source, author, version, "previewIcon", "releaseDate")
    values                 (%s    , %s,     %s,      %s,            now())
    returning id
    ''',                   (source, author, version, icon))
    application_id = cur.fetchone()[0]
    return application_id

def set_app_name(cur, app_id, lang, name):
    cur.execute('''
    insert into app_name(application_id, language, name)
                 values (%s,             %s,       %s)
    ''',                (app_id,         lang,     name))

def set_app_desc(cur, app_id, lang, desc):
    cur.execute('''
    insert into app_description(application_id, language, description)
                 values (%s,             %s,       %s)
    ''',                (app_id,         lang,     desc))

def backoffice_file_upload(request):
    cur = conn.cursor()
    if 'file' not in request.files:
        return "no file uploaded", 400
    f = request.files['file']
    if f is None or f.filename == '':
        return "no file selected", 400
    if 'app_id' not in request.form:
        return "no app_id", 400
    if 'destination' not in request.form:
        return "no destination", 400
    save_file_and_blob(cur,
                       app_id = request.form['app_id'],
                       destination = request.form['destination'],
                       data = f.read())
    conn.commit()
    return "ok", 200
    

def check_backoffice_token(token):
    try:
        cur = conn.cursor()
        cur.execute('select * from backoffice_token where id = %s', (token, ))
        return len(cur.fetchall()) > 0
    except psycopg2.Error as err:
        print(err)
        conn.rollback()
        return False

@app.route('/backoffice/<token>/backoffice.js', methods=['GET'])
def backoffice_js(token):
    if not check_backoffice_token(token):
        return "no auth", 403
    return send_file('static/backoffice/backoffice.js')

@app.route('/backoffice/<token>/backoffice.html', methods=['GET'])
def backoffice_html(token):
    if not check_backoffice_token(token):
        return "no auth", 403
    return send_file('static/backoffice/backoffice.html')

@app.route('/backoffice/<token>/templates', methods=['GET'])
def backoffice_templates_get(token):
    if not check_backoffice_token(token):
        return "no auth", 403
    cur = conn.cursor()
    cur.execute('select row_to_json(at) from application_template at')
    data = cur.fetchall()
    conn.commit()
    return jsonify([r[0] for r in data])

@app.route('/backoffice/<token>/all_apps', methods=['GET'])
def backoffice_all_apps(token):
    if not check_backoffice_token(token):
        return "no auth", 403
    cur = conn.cursor()
    cur.execute('select ra.repository_id, row_to_json(a) from application a left join repository_application ra on a.id = ra.application_id')
    data = cur.fetchall()
    conn.commit()
    rows = []
    for r in data:
        v = {'repository_id': r[0]}
        v.update(r[1])
        rows.append(v) 
    return jsonify(rows)

@app.route('/backoffice/<token>/replace_file', methods=['POST'])
def backoffice_replace_file(token):
    if not check_backoffice_token(token):
        return "no auth", 403
    cur = conn.cursor()
    if 'file' not in request.files:
        return "no file uploaded", 400
    f = request.files['file']
    if f is None or f.filename == '':
        return "no file selected", 400
    if 'app_id' not in request.form:
        return "no app_id", 400
    if 'destination' not in request.form:
        return "no destination", 400
    if 'file_id' not in request.form:
        return "no file id", 400
    app_id = request.form['app_id']
    new_file_id = save_file_and_blob(cur,
                                     app_id = app_id,
                                     destination = request.form['destination'],
                                     data = f.read())
    old_file_id = request.form['file_id']
    cur.execute('update application_file set file_id=%s where file_id=%s and application_id <> %s', (new_file_id, old_file_id, app_id))
    conn.commit()
    return "ok", 200
    
def save_file(cur, app_id, destination, size, sha1, blob_id):
    cur.execute('''
    insert into file(destination, size, hash, blob_id) 
    values          (%s,          %s,   %s,   %s)
    returning id
    ''',
                    (destination, size, sha1, blob_id))
    file_id = cur.fetchone()[0]
    cur.execute('insert into application_file(application_id, file_id) values (%s, %s)', (app_id, file_id))
    print("{}  {}".format(file_id, destination))
    return file_id

def save_file_and_blob(cur, app_id, destination, data):
    print("SFAB", app_id, destination)
    return save_file(cur,
                     app_id = app_id,
                     destination = destination,
                     size = len(data),
                     sha1 = hashlib.sha1(data).hexdigest(),
                     blob_id = save_blob(cur, data))

@app.route('/create_repo', methods=['POST'])
def create_repo():
    sizes = [250, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]
    shortname = request.json["shortname"]
    cur = conn.cursor()

    cur.execute("select id, path_prefix from clone_application((select application_id from application_template where template_type = 'maps_app'))")

    created_app_row = cur.fetchone()
    app_id = created_app_row[0]
    path_prefix = created_app_row[1]
    print("Created app id {}".format(app_id))
    for s in sizes:
        save_file_and_blob(cur,
                           app_id = app_id,
                           destination = "{}/{}/{}.png".format(path_prefix, shortname, s),
                           data = do_field(request.json, s))

    save_file_and_blob(cur,
                       app_id = app_id,
                       destination = "{}/{}/field.jsn".format(path_prefix, shortname),
                       data = json.dumps(request.json, ensure_ascii=False).encode('utf8'))

    cur.execute('insert into repository default values returning id')
    repo_id = cur.fetchone()[0]

    cur.execute('insert into repository_application(repository_id, application_id) values(%s, %s)', (repo_id, app_id))

    conn.commit()
    return url_for_repo(repo_id)

# @app.route('/upload', methods=['POST'])
@app.route('/backoffice/<token>/upload', methods=['POST'])
def backoffice_upload_zip(token):
    if not check_backoffice_token(token):
        return "no auth", 403

    cur = conn.cursor()

    print("Upload " + str(request.form))
    print("Creating application")
    application_id = create_application(cur,
                                        source = "zip upload",
                                        author = request.form['author'],
                                        version = request.form['version'],
                                        icon = request.form['previewicon'])
    print("Created application " + str(application_id))

    cur.execute('''
    insert into app_name(application_id, language, name)
    values (%s, 'en', %s)
    ''', (application_id, request.form['name']))

    cur.execute('''
    insert into app_description(application_id, language, description)
    values (%s, 'en', %s)
    ''', (application_id, request.form['description']))

    if request.method == 'POST':
        # check if the post request has the file part
        if 'file' not in request.files:
            return "error"
        file = request.files['file']
        if file.filename == '':
            return "no selected file"
        if file:
            with zipfile.ZipFile(file) as zip: 
                for zif in zip.infolist():
                    print(zif.filename)
                path_prefix = os.path.commonprefix([zi.filename for zi in zip.infolist()])
                if path_prefix == "":
                    msg = "Error: zip file must have a non-empty path prefix (must have a single top-level directory)<br>\n"
                    msg += "<br>\n".join([zi.filename for zi in zip.infolist()])
                    return msg
                prefixlen = len(path_prefix)
                cur.execute('update application set path_prefix = %s where id = %s', ('Apps/'+path_prefix, application_id))
                for zi in zip.infolist():
                    if zi.filename[-1] != '/':
                        with zip.open(zi.filename, "r") as f:
                            print("Insert blob " + str(zi.filename))
                            data = f.read()
                            cur.execute('insert into blob(data) values (%s) returning id', (psycopg2.Binary(data), ))
                            blob_id = cur.fetchone()[0]
                            
                            cur.execute('''
                            insert into file(destination, size, hash, blob_id) 
                            values          (%s,          %s,   %s,   %s)
                            returning id
                            ''',
                            ('Apps/' + zi.filename, len(data), hashlib.sha1(data).hexdigest(), blob_id))
                            file_id = cur.fetchone()[0]
                            cur.execute('insert into application_file(application_id, file_id) values (%s, %s)', (application_id, file_id))
            # ins repo
            cur.execute('insert into repository default values returning id')
            repo_id = cur.fetchone()[0]
            cur.execute('insert into repository_application(repository_id, application_id) values(%s, %s)', (repo_id, application_id))
            conn.commit()
            return """
            Created application #{}.  <a href="{}">Link to repo #{} apps.json</a>.  Go back and refresh the page to see in list of apps
            """.format(application_id, url_for_repo(repo_id), repo_id)
    return "Not a POST"

        
@app.route('/', methods=['GET'])
def whatever():
    return redirect(APP_BASE_URL + "/static/index.html", code=302)

