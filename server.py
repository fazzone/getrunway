import functools
import uuid
import io
import sys
import zipfile
import hashlib
import base64
from flask import Flask, request, jsonify, send_file
#from getrunway import do_field
from metricrunway import do_field
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

@app.route('/fancy/<image_width_m_str>', methods=['POST'])
def image_xhr(image_width_m_str):
    buf = io.BytesIO(do_field(request.json, int(image_width_m_str)))
    buf.seek(0)
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

import os
import psycopg2

DATABASE_URL = os.environ['DATABASE_URL']
conn = psycopg2.connect(DATABASE_URL, sslmode='require')


@app.route('/apps.json', methods=['GET'])
def jeti_repo():
    cur = conn.cursor()
    cur.execute("""SELECT json from apps_json_view""")
    rs = cur.fetchall()
    return {'applications': [r[0] for r in rs]}

def url_for_file(file_id):
    return 'https://gentle-bastion-87288.herokuapp.com/file/' + str(file_id)

@app.route('/file/<file_id>', methods=['GET'])
def get_file(file_id):
    cur = conn.cursor()
    cur.execute('select destination, data from file f join blob b on f.blob_id = b.id where f.id = %s', (file_id, ))
    (dest, data) = cur.fetchone()
    return send_file(io.BytesIO(data), as_attachment=True, attachment_filename=os.path.basename(dest))

from werkzeug.utils import secure_filename

@app.route('/upload', methods=['POST'])
def upload_file():
    cur = conn.cursor()
    cur.execute('''
    insert into application(author, version, "previewIcon", "releaseDate")
    values                 (%s,     %s,      %s,            now())
    returning id
    ''', (request.form['author'], request.form['version'], request.form['previewIcon']))
    application_id = cur.fetchone()[0]
    print("Application ID: " + str(application_id))
    sys.stdout.flush()

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
                for zi in zip.infolist():
                    if zi.filename[-1] != '/':
                        with zip.open(zi.filename, "r") as f:
                            data = f.read()
                            cur.execute('insert into blob(data) values (%s) returning id', (psycopg2.Binary(data), ))
                            blob_id = cur.fetchone()[0]
                            
                            cur.execute('''
                            insert into file(application_id, destination, size, hash, blob_id) 
                            values          (%s,             %s,          %s,   %s,   %s)
                            returning id
                            ''',
                            (application_id, zi.filename, len(data), hashlib.sha1(data).hexdigest(), blob_id))
                            file_id = cur.fetchone()[0]
            conn.commit()
            return "ok"


        
