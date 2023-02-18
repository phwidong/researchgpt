document.addEventListener("DOMContentLoaded", function() {
  // This file contains the JavaScript code for the web app

const input = document.querySelector("input[type='file']");
var uploadBtn = document.querySelector(".upload-btn");
const viewer = document.querySelector("#pdf-viewer");
const container = document.querySelector("#container");
var x = document.querySelector("input[name='pdf-url']");
const form = document.querySelector("form");
const p = document.querySelector("p");
const up = document.querySelector("#up");
const y = document.querySelector("#url");
const send = document.querySelector("#send");
const api_key = document.querySelector("#api-key");
const api_input = document.querySelector("input[name='api-key']");
const save = document.querySelector(".save_btn");

api_key.addEventListener("submit", function(event) {
  event.preventDefault();
  const openai_key = api_input.value;
  if (openai_key === "") {
    api_input.value = "Error: Please enter an API key";
    return;
  // save the API key to a window variable
  } else {
    window.api_key = openai_key;
  }
});

async function embeddings(df) {
  console.log('Calculating embeddings');
  const openaiApiKey = window.api_key;
  const embeddingModel = "text-embedding-ada-002";
  const embeddings = await Promise.all(df.map(async (row) => {
    const text = row.text;
    const response = await axios.post('https://api.openai.com/v1/engines/'+embeddingModel+'/completions', {
      prompt: text,
      max_tokens: 1,
      n: 1,
      stop: '',
      temperature: 0,
      frequency_penalty: 0,
      presence_penalty: 0
    }, {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.choices[0].text;
  }));
  df.map((row, index) => {
    row["embeddings"] = embeddings[index];
    return row;
  });
  console.log('Done calculating embeddings');
  return df;
}

send.addEventListener("click", function(event) {
  event.preventDefault();
  const message = document.querySelector("input[name='chat']").value;
  // if the message is empty, do nothing
  if (message === "") {
    return;
  }
  const chat = document.querySelector("#chat");
  const query = document.createElement("p");
  query.innerHTML = message;
  chat.appendChild(query);
  
  const loading = document.createElement("p");
  loading.style.color = "lightgray";
  loading.style.fontSize = "14px";
  loading.innerHTML = "Loading...";
  chat.appendChild(loading);

  // call the endpoint /prompt with the message and get the prompt.
  fetch('/prompt', {
      method: 'POST',
      body: JSON.stringify({'query': message, 'key': window.key}),
      headers: {
          'Content-Type': 'application/json'
      }
  })
  .then(response => response.json())
  

  // call the endpoint /reply with the message and get the reply.
  fetch('/reply', {
      method: 'POST',
      body: JSON.stringify({'query': message, 'key': window.key}),
      headers: {
          'Content-Type': 'application/json'
      }
  })
  .then(response => response.json())
  // Append the reply to #chat as a simple paragraph without any styling
  .then(data => {
      console.log(data.answer);
      chat.removeChild(loading);

      const reply = document.createElement("p");
      reply.style.color = "lightgray";
      reply.style.marginBottom = "0px";
      reply.style.paddingTop = "0px";
      reply.innerHTML = data.answer;
      chat.appendChild(reply);
      chat.scrollTop = chat.scrollHeight;

      const sources = data.sources;
      console.log(sources)
      // console.log(typeof JSON.parse(sources))
      sources.forEach(function(source) {
        for (var page in source) {
          var p = document.createElement("p");
          p.style.color = "gray";
          p.style.fontSize = "12px";
          p.style.fontWeight = "bold";
          p.style.marginTop = "0px";
          p.style.marginBottom = "0px";
          p.style.paddingTop = "0px";
          p.style.paddingBottom = "5px";
          p.innerHTML = page + ": " + "'"+source[page];+"'"
          chat.appendChild(p);
        }
      });
    })
    .catch(error => {
      chat.removeChild(loading);
      console.error(error);
    
      const errorMessage = document.createElement("p");
      errorMessage.style.color = "red";
      errorMessage.style.marginBottom = "0px";
      errorMessage.style.paddingTop = "0px";
      errorMessage.innerHTML = "Error: Request to OpenAI failed. Please try again.";
      chat.appendChild(errorMessage);
      chat.scrollTop = chat.scrollHeight;
    });
  document.querySelector("input[name='chat']").value = "";
});

x.addEventListener("focus", function() {
    if (this.value === "Enter URL") {
    this.value = "";
    this.style.color = "black";
    }
});

y.addEventListener("submit", function(event) {
    event.preventDefault();
    const url = this.elements["pdf-url"].value;
    if (url === "") {
        return;
    }
    // if the url does not end with .pdf, make x.value = "Error: URL does not end with .pdf"
    if (!url.endsWith(".pdf")) {
        x.value = "Error: URL does not end with .pdf";
        return;
    }
    x.value = "Loading...";
    console.log(url);
    fetch(url)
    .then(response => response.blob())
    .then(pdfBlob => {
        console.log(pdfBlob);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        pdfjsLib.getDocument(pdfUrl).promise.then(pdfDoc => {
            viewer.src = pdfUrl;
            uploadBtn.style.display = "none";
            form.style.display = "none";
            form.style.marginTop = "0px";
            p.style.display = "none";
            up.style.display = "none";
            container.style.display = "flex";
            viewer.style.display = "block";
        });
        })
        .catch(error => {
            console.error(error);
        });
    var loading = document.createElement("p");
    loading.style.color = "lightgray";
    loading.style.fontSize = "14px";
    loading.innerHTML = "Calculating embeddings...";
    chat.appendChild(loading);

    // Make a POST request to the server 'myserver/download-pdf' with the URL
    fetch('/download_pdf', {
      method: 'POST',
      body: JSON.stringify({'url': url}),
      headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
      })
      .then(response => response.json())
      // Append the reply to #chat as a simple paragraph without any styling
      .then(data => {
        chat.removeChild(loading);
        window.key = data.key;
      })
      .catch(error => {
        uploadBtn.innerHTML = "Error: You are on a non-secure connection and missing https:// at the beginning. Please <a href=' https://researchgpt.ue.r.appspot.com'>click here</a> to go to the secure version.";
        loading.innerHTML = "Error: Request to server failed. Please refresh try uploading a copy of the pdf instead. Sorry for the inconvenience!";
        x.innerHTML = "Error: Request to server failed. Please try uploading the pdf instead. Sorry for the inconvenience!";
        console.error(error);
      });
});

input.addEventListener("change", async function() {
  const file = this.files[0];
  const fileArrayBuffer = await file.arrayBuffer();
  console.log(fileArrayBuffer);

  var loading = document.createElement("p");
  loading.style.color = "lightgray";
  loading.style.fontSize = "14px";
  loading.innerHTML = "Calculating embeddings...";
  chat.appendChild(loading);

  // Make a post request to /process_pdf with the file
  fetch('/process_pdf', {
      method: 'POST',
      body: fileArrayBuffer,
      headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': fileArrayBuffer.byteLength,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
  })
  .then(response => response.json())
  .then(data => {
    chat.removeChild(loading);
    window.key = data.key;
    e = embeddings(data.df)
    fetch('/save', {
      method: 'POST',
      body: JSON.stringify({'key': data.key, 'df': e}),
      headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
      })
      .then(response => response.json())
      .then(data => {
        window.key = data.key;
        console.log(data);
    })
  })
  .catch(error => {
    loading.innerHTML = "Error: Request to server failed. Your pdf might not be compatible. Try entering a link to a version hosted online. Make sure it ends with .pdf. Sorry for the inconvenience!";
    console.error(error);
  });
    
  pdfjsLib.getDocument(fileArrayBuffer).promise.then(pdfDoc => {
  viewer.src = URL.createObjectURL(file);
  uploadBtn.style.display = "none";
  form.style.display = "none";
  form.style.marginTop = "0px";
  p.style.display = "none";
  up.style.display = "none";
  container.style.display = "flex";
  viewer.style.display = "block";
  }).catch(error => {
  console.error(error);
  });
});
});
