import weakref
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
# weakref.WeakValueDictionary()
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

