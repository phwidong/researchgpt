from flask import Flask, request, render_template
from io import BytesIO
from PyPDF2 import PdfReader
import pandas as pd
import os
from flask_cors import CORS
from _md5 import md5
from google.cloud import storage
import base64
import json

app = Flask(__name__)

os.environ['CLOUD_STORAGE_BUCKET'] = 'researchgpt.appspot.com'
CLOUD_STORAGE_BUCKET = os.environ['CLOUD_STORAGE_BUCKET']

CORS(app)

class Chatbot():
    
    def extract_text(self, pdf):
        print("Parsing paper")
        number_of_pages = len(pdf.pages)
        print(f"Total number of pages: {number_of_pages}")
        paper_text = []
        for i in range(number_of_pages):
            page = pdf.pages[i]
            page_text = []

            def visitor_body(text, cm, tm, fontDict, fontSize):
                x = tm[4]
                y = tm[5]
                # ignore header/footer
                if (y > 50 and y < 720) and (len(text.strip()) > 1):
                    page_text.append({
                    'fontsize': fontSize,
                    'text': text.strip().replace('\x03', ''),
                    'x': x,
                    'y': y
                    })

            _ = page.extract_text(visitor_text=visitor_body)

            blob_font_size = None
            blob_text = ''
            processed_text = []

            for t in page_text:
                if t['fontsize'] == blob_font_size:
                    blob_text += f" {t['text']}"
                    if len(blob_text) >= 2000:
                        processed_text.append({
                            'fontsize': blob_font_size,
                            'text': blob_text,
                            'page': i
                        })
                        blob_font_size = None
                        blob_text = ''
                else:
                    if blob_font_size is not None and len(blob_text) >= 1:
                        processed_text.append({
                            'fontsize': blob_font_size,
                            'text': blob_text,
                            'page': i
                        })
                    blob_font_size = t['fontsize']
                    blob_text = t['text']
                paper_text += processed_text
        print("Done parsing paper")
        return paper_text

    def create_df(self, pdf):
        print('Creating dataframe')
        filtered_pdf= []

        for row in pdf:
            if len(row['text']) < 30:
                continue
            filtered_pdf.append(row)
        df = pd.DataFrame(filtered_pdf)

        # remove elements with identical df[text] and df[page] values
        df = df.drop_duplicates(subset=['text', 'page'], keep='first')

        print('Done creating dataframe')
        return df

@app.route("/", methods=["GET", "POST"])
def index():
    return render_template("index.html")

@app.route("/favicon.ico", methods=["GET"])
def icon():
    return render_template("favicon.ico")

# a route to get the dataframe from the database
@app.route("/get_df", methods=['POST'])
def get_df():
    print('Getting dataframe')
    key = request.json['key']
    print(key)

    if key is None or key == '' or key == 'null' or key == 'undefined':
        print("No key found")
        return {"error": "No key found"}

    query = request.json['query']
    print(query)
    
    # Create a Cloud Storage client.
    gcs = storage.Client()
    name = key+'.json'
    bucket = gcs.get_bucket(CLOUD_STORAGE_BUCKET)
    blob = bucket.blob(name)
    if not blob.exists():
        return {"error": "File does not exist"}
    df = pd.read_json(BytesIO(blob.download_as_string()))

    print('Done getting dataframe')
    json_str = df.to_json(orient='records')

    return {"df": json_str}

# re-writing process_pdf to to just create the dataframe and send it to the frontend
@app.route("/process_pdf", methods=['POST'])
def process_pdf():
    print("Processing pdf")
    print(request)

    file = request.data

    key = md5(file).hexdigest()
    print(key)

    # Create a Cloud Storage client.
    gcs = storage.Client()
    name = key+'.json'

    # Get the bucket that the file will be uploaded to.
    bucket = gcs.get_bucket(CLOUD_STORAGE_BUCKET)
    # Check if the file already exists
    if bucket.blob(name).exists():
        print("File already exists")
        print("Done processing pdf")
        return {"key": key, "exists": True}

    pdf = PdfReader(BytesIO(file))
    chatbot = Chatbot()
    paper_text = chatbot.extract_text(pdf)
    df = chatbot.create_df(paper_text)

    json_str = df.to_json(orient='records')
    # print(len(json_str))
    print("Done processing pdf")
    return {"key": key, "df": json_str}

# a function save that takes in a dataframe and saves it to gcs
@app.route("/save", methods=['POST'])
def save():
    print("Saving df to gcs")

    df = request.json['df']
    key = request.json['key']

    df = pd.DataFrame.from_dict(df)
    
    # Return error if the dataframe is empty
    if df.empty:
        return {"error": "No data found"}

    # Create a Cloud Storage client.
    gcs = storage.Client()
    name = key+'.json'

    # Get the bucket that the file will be uploaded to.
    bucket = gcs.get_bucket(CLOUD_STORAGE_BUCKET)
    # Check if the file already exists
    if bucket.blob(name).exists():
        print("File already exists")
        print("Done processing pdf")
        return {"key": key, "exists": True}

    # Create a new blob and upload the file's content.
    blob = bucket.blob(name)
    blob.upload_from_string(df.to_json(), content_type='application/json')
    
    print("Saved pdf")
    return {"key": key, "exists": False}

@app.route("/download_pdf", methods=['POST'])
def download_pdf():
    print("Downloading pdf")
    # print(request.json)
    chatbot = Chatbot()
    url = request.json['url']
    data = request.json['data']
    data = base64.b64decode(data)

    print(url)

    print("Downloading pdf")
    key = md5(data).hexdigest()
    print(key)

    # Create a Cloud Storage client.
    gcs = storage.Client()
    name = key+'.json'

    # Get the bucket that the file will be uploaded to.
    bucket = gcs.get_bucket(CLOUD_STORAGE_BUCKET)
    # Check if the file already exists
    if bucket.blob(name).exists():
        print("File already exists")
        print("Done processing pdf")
        return {"key": key, "exists": True}

    pdf = PdfReader(BytesIO(data))
    paper_text = chatbot.extract_text(pdf)
    df = chatbot.create_df(paper_text)

    json_str = df.to_json(orient='records')

    print("Done processing pdf")
    return {"key": key, "df": json_str}

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, debug=True)
