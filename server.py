import uuid
import io
import sys
import zipfile
from flask import Flask, request, jsonify, send_file
from getrunway import do_field
app = Flask(__name__)

registered_fields = {}

@app.route('/register', methods=['POST'])
def go():
    global registered_fields
    k = str(uuid.uuid4())
    
    registered_fields[k] = request.json
    return jsonify({'registered': str(k)})

@app.route('/generate/<uuid>', methods=['GET'])
def generate(uuid):
    global registered_fields
    if uuid not in registered_fields:
        return 'whoops'
    image_files = do_field(registered_fields[uuid], in_memory = True)
    bio = io.BytesIO()
    zf = zipfile.ZipFile(bio, "w")
    for filename, image_bytes in image_files.items():
        zf.writestr(filename, image_bytes)
    zf.close()
    bio.seek(0)
    return send_file(bio, as_attachment=True, attachment_filename="{}.zip".format(uuid))

