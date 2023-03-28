from flask import Flask, request, render_template, jsonify, Response, send_file, make_response
import base64
from io import BytesIO
from PyPDF2 import PdfReader
import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)
import pandas as pd
import os
import requests
from flask_cors import CORS
from _md5 import md5
from google.cloud import storage
import docx

app = Flask(__name__)

# os.environ['CLOUD_STORAGE_BUCKET'] = 'researchgpt.appspot.com'
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
        # print(paper_text)
        return paper_text
    
    # A function that parses through a string and returns a dataframe with the text and the page number. 
    # Split the text into chunks of 2000 characters
    def extract_df(self, text):
        df = pd.DataFrame(columns=['text', 'page'])
        page = 0
        for i in range(0, len(text), 2000):
            df = df.append({'text': text[i:i+2000], 'page': page}, ignore_index=True)
            page += 1
        return df

    # A function that parses through a pdf and returns a dataframe with the text and the page number
    def make_df(self, pdf):
        df = pd.DataFrame(columns=['text', 'page'])
        for i in range(len(pdf.pages)):
            page = pdf.pages[i]
            text = page.extract_text()
            text = text.replace('\n', ' ')
            text = text.strip().replace('\x03', '')
            df = df.append({'text': text, 'page': i}, ignore_index=True)
        return df

    # A function that parses through a docx and returns a dataframe with the text and the paragraph number
    def make_doc(self, doc):
        df = pd.DataFrame(columns=['text', 'paragraph'])
        for i in range(len(doc.paragraphs)):
            paragraph = doc.paragraphs[i]
            text = paragraph.text
            text = text.replace('\n', ' ')
            text = text.strip().replace('\x03', '')
            df = df.append({'text': text, 'paragraph': i}, ignore_index=True)
            # drop row if text is empty
            df = df.drop(df[df['text'] == ''].index)
        return df

    def create_df(self, pdf):
        print('Creating dataframe')
        filtered_pdf= []
        for row in pdf:
            if len(row['text']) < 30:
                continue
            filtered_pdf.append(row)
        df = pd.DataFrame(filtered_pdf)
        # print(df.shape)
        # remove elements with identical df[text] and df[page] values
        df = df.drop_duplicates(subset=['text', 'page'], keep='first')
        df['length'] = df['text'].apply(lambda x: len(x))
        print('Done creating dataframe')
        return df

@app.route('/viewer')
def viewer():
    return render_template('viewer.html')

# @app.route('/plus.png', methods=['GET'])
# def title():
#     return send_file('plus.png', mimetype='image/png')

@app.route('/app.html', methods=['GET'])
def grid():
    return render_template('test.html')

@app.route('/save_file', methods=['POST'])
def save_file():
    print('Saving file')
    file = request.data
    # Get model from header
    model = request.headers.get('model')
    print(model)
    key = md5(file).hexdigest()
    print(key)

    # get content type from header
    content_type = request.headers.get('Content-Type')

    # Save file to GCP bucket
    gcs = storage.Client()
    bucket = gcs.get_bucket('mukuls-public-bucket')
    if not bucket:
        print('Bucket does not exist')
        return jsonify({"error": "Bucket does not exist"})
    # check if file already exists
    blob = bucket.blob(key)
    if blob.exists():
        print('File already exists')
        return jsonify({"key": key, "exists": True})

    # If the file is type docx or msword, save it to GCP bucket as msword
    if content_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or content_type == 'application/msword':
        print('File is docx')
        file_type = 'application/msword'
        bucket = gcs.get_bucket('mukuls-public-bucket')
        blob = bucket.blob(key)
        if not bucket:
            print('Bucket does not exist')
            return jsonify({"error": "Bucket does not exist"})
                # check if file already exists
        blob = bucket.blob(key)
        if blob.exists():
            print('File already exists')
            return jsonify({"key": key, "exists": True})

        blob.upload_from_string(file, content_type=file_type)
        print('File saved to GCP bucket')
        return jsonify({"key": key, "exists": False, "file_type": file_type})

    elif content_type == 'application/pdf':
        print('File is pdf')
        file_type = 'application/pdf'

        blob = bucket.blob(key)

        # Check if the file already exists
        if bucket.blob(key).exists():
            print("File already exists")
            print("Done processing pdf")
            return {"key": key, "exists": True}
        
        blob.upload_from_string(file, content_type=file_type)

        print("Done processing pdf")
        return jsonify({"key": key, "exists": False, "file_type": file_type})

    elif content_type == 'text/plain':
        print('File is txt')
        file_type = 'text/plain'
        # Save file to GCP bucket
        blob = bucket.blob(key)
        blob.upload_from_string(file, content_type=file_type)

    else:
        print('File type not supported')
        print(content_type)
        return jsonify({"error": "File type not supported"})


    print('File uploaded to GCP bucket')

    return jsonify({"key": key, "exists": False, "file_type": file_type})


@app.route('/get_file/<file_id>', methods=['GET'])
def get_file(file_id):
    # get 'type' from header
    file_type = request.headers.get('type')
    print('Getting file from GCP bucket')
    print(file_id)
    # Get file from GCP bucket
    gcs = storage.Client()
    bucket = gcs.get_bucket('mukuls-public-bucket')
    if not bucket:
        print('Bucket does not exist')
        return jsonify({"error": "Bucket does not exist"})
    # check if file already exists
    blob = bucket.blob(file_id)

    if not blob.exists():
        print('File does not exist')
        return jsonify({"error": "File does not exist"})
    
    url = blob.public_url
    print('File url: ', url)

    # Get the file from GCP bucket
    if file_type == 'text/plain':
        print('File is pdf')
        file_type = 'text/plain'
        text = blob.download_as_string()
        chatbot = Chatbot()
        df = chatbot.extract_df(text)
        print(df)
        json_str = df.to_json(orient='records')
        return jsonify({"url": url, "file_type": file_type, "df": json_str})

    
    return jsonify({"url": url, "file_type": file_type})
    

@app.route("/", methods=["GET", "POST"])
def index():
    return render_template("index.html")

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

@app.route("/download_pdf", methods=['POST'])
def download_pdf():
    print("Downloading pdf")
    print(request.json)
    chatbot = Chatbot()
    t = request.json['type']

    model = request.json['model']
    # print(data)

    if t == 'application/pdf':
        print('File is pdf')
        file_type = 'application/pdf'
            
        data = request.json['data']

        # Decode the base64 string
        data = base64.b64decode(data)

        key = md5(data).hexdigest()
        print(key)
        pdf = PdfReader(BytesIO(data))

        if model == 'gpt-4':
            df = chatbot.make_df(pdf)
        else: 
            paper_text = chatbot.extract_text(pdf)
            df = chatbot.create_df(paper_text)
        json_str = df.to_json(orient='records')

    elif t == 'application/msword' or t == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        url = request.json['url']
        print(url)
        r = requests.get(url, allow_redirects=True, headers={
        "Origin": "appspot.com", 'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'})

        file = r.content

        doc = docx.Document(BytesIO(file)) 

        key = md5(file).hexdigest()

        chatbot = Chatbot()
        df = chatbot.make_doc(doc)
        json_str = df.to_json(orient='records')

    else:
        url = request.json['url']
        print(url)
        r = requests.get(url, allow_redirects=True, headers={
        "Origin": "appspot.com", 'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'})

        file = r.content

        key = md5(file).hexdigest()

        # Make a dataframe of the text and paragraphs from 'file'
        chatbot = Chatbot()

        def read_txt_file(file):
            paragraphs = file.split('\n').split('\r').replace('\n', '').replace('\r', '').replace('\t', '').replace('&#160;', '')
            df = pd.DataFrame(paragraphs, columns=['text'])
            print(df)
            df['paragraph_number'] = df.index
            return df
        
        df = read_txt_file(file.decode('utf-8'))

        json_str = df.to_json(orient='records')

    # Create a Cloud Storage client.
    gcs = storage.Client()
    name = key+'.json'

    # Get the bucket that the file will be uploaded to.
    bucket = gcs.get_bucket(CLOUD_STORAGE_BUCKET)
    # Check if the file already exists
    if bucket.blob(name).exists():
        print("File already exists")
        print("Done processing pdf")
        return jsonify({"key": key, "exists": True})   


    print("Done processing pdf")
    return jsonify({"key": key, "exists": False, "df": json_str})

@app.route("/reply", methods=['POST'])
def reply():
    chatbot = Chatbot()
    key = request.json['key']
    query = request.json['query']
    query = str(query)
    print(query)
    # df = pd.read_json(BytesIO(db.get(key)))
    gcs = storage.Client()
    bucket = gcs.get_bucket(CLOUD_STORAGE_BUCKET)
    blob = bucket.blob(key+'.json')
    df = pd.read_json(BytesIO(blob.download_as_string()))
    print(df.head(5))
    prompt = chatbot.create_prompt(df, query)
    response = chatbot.gpt(prompt)
    print(response)
    return response, 200

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080, debug=True)
