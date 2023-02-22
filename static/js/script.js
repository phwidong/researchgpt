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

  window.onload = function() {
    // check if the user has already saved an API key
    if (sessionStorage.getItem("openai_key") === null) {
      var input = prompt("Please enter your Open AI api key. Don't worry, it will be saved only in your browser's local storage.");
      // if the field is empty, show the prompt again
      if (input === "") {
        alert("You must enter an API key to use the chatbot.");
        // show the prompt again
        window.onload();
        return;
      }
      // If the user clicks cancel, do nothing
      if (input === null) {
        return;
      }
      sessionStorage.setItem("openai_key", input);
      alert("Thank you! Your key has been saved safely in your browser's local storage. You can now use the chatbot.");
    }
    else {
      console.log("API key already saved");
      return;
    }
  };

  x.addEventListener("focus", function() {
    if (this.value === "Enter URL") {
    this.value = "";
    this.style.color = "black";
    }
  });

  async function embeddings(df) {
    console.log('Calculating embeddings');
    const openaiApiKey = sessionStorage.getItem("openai_key");
    const embeddingModel = "text-embedding-ada-002";
    df = JSON.parse(df);
  
    // Use a for loop to wait for the response from the API before continuing
    for (let i = 0; i < df.length; i++) {
      const text = df[i].text;
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: text,
            model: embeddingModel
          })
        });
        // Call the json method on the response to get the data
        const data = await response.json();
        // if the response is an error, log it and return
        if (data.error) {
          console.log(`Error calculating embedding for text: ${text}`, data.error);
          return "error";
        }
        df[i]["embeddings"] = data.data[0].embedding;
      } catch (error) {
        console.log(`Error calculating embedding for text: ${text}`, error);
        return "error";
      }
    }
    console.log('Done calculating embeddings');
    return df;
  }
  
  function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
  
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
  
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  async function search(df, query, n=3, pprint=true) {
    const openaiApiKey = sessionStorage.getItem("openai_key");
    const embeddingModel = "text-embedding-ada-002";
    const queryEmbeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: query,
        model: embeddingModel
      })
    });
    const queryEmbeddingData = await queryEmbeddingResponse.json();
    const queryEmbedding = queryEmbeddingData.data[0].embedding;
  
    const results = df.map((row) => {
      const similarity = cosineSimilarity(row.embeddings, queryEmbedding);
      return {...row, similarity};
    }).sort((a, b) => b.similarity - a.similarity).slice(0, n);
  
    const sources = results.map((result, i) => ({
      [`Page ${i + 1}`]: result.text.slice(0, 150) + "..."
    }));
  
    console.log(sources);
  
    return {
      results,
      sources
    };
  }  

  async function create_prompt(user_input) {
    // check if pdf-key is not null
    if (sessionStorage.getItem("pdf-key") === null || sessionStorage.getItem("pdf-key") === "" || sessionStorage.getItem("pdf-key") === "undefined") {
      alert("Please upload a PDF file first or refresh the page and try again.");
      return;
    }
    const response = await fetch('/get_df', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          'key': sessionStorage.getItem("pdf-key"),
          'query': user_input,
          })
      })
      .catch((error) => {
        console.log('Error:', error);
        document.getElementById('loading').innerHTML = 'Error: ' + error + '. Please make sure your api key is correct and try again. Close this tab and refresh the page to try again.';
      });
    const data = await response.json();
    df = data.df;
    if (data.error) {
      alert(data.error);
      document.getElementById('loading').innerHTML = 'Error: ' + error + '. Please make sure your api key is correct and try again. Close this tab and refresh the page to try again.';
      return;
    }
    df = JSON.parse(df);
    const x = await search(df, user_input);
    const result = x.results;
    const sources = x.sources;
    // console.log(result);
    const prompt = `You are a large language model whose expertise is reading and summarizing scientific papers. 
    You are given a query and a series of text embeddings from a paper in order of their cosine similarity to the query.
    You must take the given embeddings and return a very detailed summary of the paper that answers the query.

    Given the question: ${user_input}

    and the following embeddings as data: 

    1. ${result.at(0, 'text')}
    2. ${result.at(1, 'text')}
    3. ${result.at(2, 'text')}

    Return a detailed answer based on the paper:`;

    console.log('Done creating prompt');
    return { prompt, sources };
  }

  async function gpt(prompt, sources) {
    console.log('Sending request to GPT-3');
    const openaiApiKey = sessionStorage.getItem("openai_key");
    const response = await axios.post('https://api.openai.com/v1/engines/text-davinci-003/completions', {
      prompt: prompt,
      max_tokens: 1500,
      n: 1,
      stop: '',
      temperature: 0.4,
      frequency_penalty: 0,
      presence_penalty: 0
    }, {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
    const answer = response.data.choices[0].text;
    console.log('Done sending request to GPT-3');
    return { answer, sources };
  }

  uploadBtn.addEventListener("click", async function(event) {
    // event.preventDefault();
    // Check if openai_key is set in sessionStorage
    if (sessionStorage.getItem("openai_key") === null) {
      // If not, prompt the user to enter their OpenAI API key
        var input = prompt("Please enter your OpenAI API key first. Don't worry, it will be saved only in your browser's local storage.");
        if (input === "") {
          alert("You must enter an API key to use the chatbot.");
          // show the prompt again
          window.onload();
          return;
        }
        // If the user clicks cancel, do nothing
        if (input === null) {
          return;
        }
        sessionStorage.setItem("openai_key", input);
        alert("Thank you! Your key has been saved safely in your browser's local storage. You can now use the chatbot.");

        return;
    }
  });

  send.addEventListener("click", async function(event) {
    event.preventDefault();
    const message = document.querySelector("input[name='chat']").value;
    // if the message is empty, do nothing
    if (message === "") {
      return;
    }
    document.querySelector("input[name='chat']").value = "";

    const chat = document.querySelector("#chat");
    const query = document.createElement("p");
    query.innerHTML = message;
    chat.appendChild(query);
    
    const loading = document.createElement("p");
    loading.style.color = "lightgray";
    loading.style.fontSize = "14px";
    loading.innerHTML = "Loading...";
    chat.appendChild(loading);

    prompt = await create_prompt(message);

    console.log(prompt);
    gpt(prompt.prompt, prompt.sources)
    .then(data => {
      // console.log(data);
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
          p.style.marginBottom = "0px";
          p.style.paddingTop = "0px";
          p.innerHTML = page + ": " + source[page];
          chat.appendChild(p);
        }
      });
    })
    .catch(error => {
      chat.removeChild(loading);
      console.log(error);

      const errorMessage = document.createElement("p");
      errorMessage.style.color = "red";
      errorMessage.style.marginBottom = "0px";
      errorMessage.style.paddingTop = "0px";
      errorMessage.innerHTML = "Error: Request to OpenAI failed. Please make sure you entered your key correctly. If you would like to set it again, please click <label class='upload-btn' style='cursor: pointer; color: blue;'>here</label>.";
      chat.appendChild(errorMessage);
      chat.scrollTop = chat.scrollHeight;
  });
  });

  y.addEventListener("submit", async function(event) {
    event.preventDefault();
    // Check if openai_key is set in sessionStorage
    const openaiKey = sessionStorage.getItem("openai_key");
    if (!openaiKey) {
      // If not, prompt the user to enter their OpenAI API key
      const input = prompt("Please enter your OpenAI API key first. Don't worry, it will be saved only in your browser's local storage.");
      sessionStorage.setItem("openai_key", input);
      alert("Thank you! Your key has been saved safely in your browser's local storage. You can now use the chatbot.");
      return;
    }
  
    const url = this.elements["pdf-url"].value;
    if (url === "") {
      return;
    }
  
    // if the url does not end with .pdf, set error messages
    if (!url.endsWith(".pdf")) {
      x.value = "Error: URL does not end with .pdf";
      return;
    }
  
    try {
      x.value = "Loading...";
      console.log(url);
  
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to download PDF.");
      }
  
      const pdfBlob = await response.blob();
  
      const pdfUrl = URL.createObjectURL(pdfBlob);
      // const pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
  
      viewer.src = pdfUrl;
      uploadBtn.style.display = "none";
      form.style.display = "none";
      form.style.marginTop = "0px";
      p.style.display = "none";
      up.style.display = "none";
      container.style.display = "flex";
      viewer.style.display = "block";

      const chatInput = document.querySelector("input[name='chat']");
      chatInput.value = "Please wait while the PDF is being loaded...";
      chatInput.readOnly = true;
  
      const loading = document.createElement("p");
      loading.id = "loading";
      loading.style.color = "lightgray";
      loading.style.fontSize = "14px";
      loading.innerHTML = "Calculating embeddings...";
      chat.appendChild(loading);
  
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const pdfData = reader.result.split(",")[1];
        const body = JSON.stringify({ url, data: pdfData });
  
        const downloadResponse = await fetch("/download_pdf", {
          method: "POST",
          body,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
        const downloadData = await downloadResponse.json();
  
        window.key = downloadData.key;
        sessionStorage.setItem("pdf-key", downloadData.key);
  
        // if (downloadData.exists) is true, then return
        if (downloadData.exists === true) {
          console.log("Embeddings already exist");
          chat.removeChild(loading);
          document.querySelector("input[name='chat']").readOnly = false;
          document.querySelector("input[name='chat']").value = "";
          return;
        }
  
        try {
          const e = await embeddings(downloadData.df);

          // if e is null or undefined or error, then return. Don't save the embeddings
          if (e === "error") {
            console.log("Embeddings could not be calculated");
            loading = document.getElementById("loading");
            loading.innerHTML = "Error: Your OpenAI API key might invalid. Please make sure you entered your key correctly. If you would like to set it again, please close the tab and try again. Sorry for the inconvenience!";
            alert("Error: Your OpenAI API key might invalid. Please make sure you entered your key correctly. If you would like to set it again, please close the tab and try again. Sorry for the inconvenience!");
            return false;
          } else if (e === null || e === undefined) {
            console.log("Embeddings could not be calculated");
            loading = document.getElementById("loading");
            loading.innerHTML = "Error: Embeddings could not be calculated. Please try again later.";
            alert("Error: Embeddings could not be calculated. Please try again later.");
            return false;
          } else {
              // Make a post request to /save with the key and embeddings
              const saveResponse = await fetch("/save", {
                method: "POST",
                body: JSON.stringify({ key: window.key, df: e }),
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                  "Access-Control-Allow-Headers": "Content-Type, Authorization",
                },
              });
      
              const saveData = await saveResponse.json();
              chat.removeChild(loading);
              document.querySelector("input[name='chat']").readOnly = false;
              document.querySelector("input[name='chat']").value = "";

              console.log(saveData);
              // if (saveData.success) is true, then return
              if (saveData.success === true) {
                console.log("Embeddings saved successfully");
                return;
              }
            }

        } catch (error) {
          console.log(error);
          console.log("Embeddings could not be calculated");
          loading.innerHTML = "Error: Your OpenAI API key might invalid. Please make sure you entered your key correctly. If you would like to set it again, please close the tab and try again. Sorry for the inconvenience!";
          alert("Error: Your OpenAI API key might invalid. Please make sure you entered your key correctly. If you would like to set it again, please close the tab and try again. Sorry for the inconvenience!");
            
        }
      };
    } catch (error) {
      console.log(error);
      x.value = "Error: Failed to download PDF.";
    }
  });

  input.addEventListener("change", async function() {
    // Check if openai_key is set in sessionStorage
    const openaiKey = sessionStorage.getItem("openai_key");
    if (!openaiKey) {
      // If not, prompt the user to enter their OpenAI API key
      const inputKey = prompt("Please enter your OpenAI API key first. Don't worry, it will be saved only in your browser's local storage.");
      sessionStorage.setItem("openai_key", inputKey);
      return;
    }

    const file = this.files[0];
    const fileArrayBuffer = await file.arrayBuffer();

    const chatInput = document.querySelector("input[name='chat']");
    chatInput.value = "Please wait while the PDF is being loaded...";
    chatInput.readOnly = true;

    const loading = document.createElement("p");
    loading.id = "loading";
    loading.style.color = "lightgray";
    loading.style.fontSize = "14px";
    loading.innerHTML = "Calculating embeddings...";
    chat.appendChild(loading);

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
      console.log(error);
    });

    // Make a post request to /process_pdf with the file
    try {
      const response = await fetch('/process_pdf', {
        method: 'POST',
        body: fileArrayBuffer,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': fileArrayBuffer.byteLength,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
      const data = await response.json();

      window.key = data.key;
      sessionStorage.setItem("pdf-key", data.key);
      if (data.exists === true) {
        console.log("Embeddings already exist");
        chatInput.readOnly = false;
        chatInput.value = "";
        loading.innerHTML = "";
        return;
      }

      console.log("DUCK");
      const e = await embeddings(data.df);
      console.log(e);

      // if e is null or there is an error, return
      if (e === "error") {
        loading.innerHTML = "Error: Request to server failed. Please refresh try uploading a copy of the pdf instead. Sorry for the inconvenience!";
        alert("Error: Request to server failed. Please make sure your API key is correct. Close this tab and try again. Sorry for the inconvenience!");
        return;
      }
      // Make a post request to /save with the key and embeddings
      const saveResponse = await fetch('/save', {
        method: 'POST',
        body: JSON.stringify({'key': window.key, 'df': e}),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
      const saveData = await saveResponse.json();
      chat.removeChild(loading);
      console.log(saveData);
      chatInput.readOnly = false;
      chatInput.value = "";
    } catch (error) {
      if (error.name === "TypeError") {
        uploadBtn.innerHTML = "Error: Request to server failed. You may be on a non-secure connection and missing https:// at the beginning. Please <a href=' https://researchgpt.ue.r.appspot.com'>click here</a> to go to the secure version. Sorry for the inconvenience!";
        loading.innerHTML = "Error: Request to server failed. Your pdf might not be compatible. Try entering a link to a version hosted online. Make sure it ends with .pdf. Sorry for the inconvenience!";
      } else {
        loading.innerHTML = "Error: Request to server failed. Please refresh try uploading a copy of the pdf instead. Sorry for the inconvenience!";
      }
      console.log(error);
    }

    });

});