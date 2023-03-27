document.addEventListener("DOMContentLoaded", async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const file_id = urlParams.get("file_id");
    const type = urlParams.get("type");
    const str = urlParams.get("str");
    const key = file_id
    sessionStorage.setItem("pdf-key", key);

    const viewer = document.querySelector("#pdf-viewer");
    const container = document.querySelector("#container");
    const p = document.querySelector("p");
    const send = document.querySelector("#send");
    const chat = document.querySelector("#chat");

    container.style.display = "flex";

    loading = document.createElement("p");
    loading.style.color = "lightgray";
    loading.style.fontSize = "14px";
    loading.innerHTML = "";
    chat.appendChild(loading);

    var m = await getGPTModel();

    download();
    
    window.onload = async function() {
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

    async function download(){
        async function getFileURL(key) {
            const response = await fetch(`/get_file/${key}`, {
              method: 'GET',
              headers: {
                  'Content-Type': 'application/json',
                  'Type': type
              }
              });
            
          if (response.status !== 200) {
              alert('There was an error. Please try again.');
              throw new Error('Error: ' + response.status);
            }
            console.log(response);
            const data = await response.json();
            return data;
          }
      
        
        const file = await getFileURL(key);
        console.log(file);

        if (type === "application/msword" || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            // Change the iframe src to the file url
            viewer.src = 'https://view.officeapps.live.com/op/embed.aspx?src=' + file.url;
            
            try {
                const response = await fetch('/download_pdf', {
                    method: 'POST',
                    body: JSON.stringify({ key: sessionStorage.getItem("pdf-key"), url: file.url, model: m, type: type }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                const data = await response.json();

                if (data.exists === true) {
                    console.log("Embeddings already exist");
                    chat.removeChild(loading);
                    document.querySelector("input[name='chat']").readOnly = false;
                    document.querySelector("input[name='chat']").value = "";
                    return;
                  }
        
                try {
        
                  const e = await embeddings(data.df);
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
                        body: JSON.stringify({key: sessionStorage.getItem("pdf-key"), df: e}),
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
                  return false;   
                }
            } catch (error) {
                console.log(error);
            }

        }
          
        if (type === "application/pdf") {
            try {
              // x.value = "Loading...";
              console.log(file.url);
          
              const response = await fetch(file.url);
              if (!response.ok) {
                throw new Error("Failed to download PDF.");
              }
          
              const pdfBlob = await response.blob();
          
              const pdfUrl = URL.createObjectURL(pdfBlob);
              // const pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
          
              viewer.src = pdfUrl;
              container.style.display = "flex";
              viewer.style.display = "block";
      
              const chatInput = document.querySelector("input[name='chat']");
              chatInput.value = "Please wait while the PDF is being loaded...";
              chatInput.readOnly = true;
      
              // Convert the Blob to an ArrayBuffer
              const buffer = await pdfBlob.arrayBuffer();
      
              function arrayBufferToBase64(buffer) {
                  let binary = '';
                  const bytes = new Uint8Array(buffer);
                  const len = bytes.byteLength;
                
                  for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                  }
                
                  return btoa(binary);
                }
      
              const base64 = arrayBufferToBase64(buffer);
                
              // Send the Base64 string in the request body
              const df = await fetch("/download_pdf", {
              method: "POST",
              body: JSON.stringify({ key: sessionStorage.getItem("pdf-key"), data: base64, model: m, type: type }),
              headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                  "Access-Control-Allow-Headers": "Content-Type, Authorization",
              },
              });
      
              const data = await df.json();
      
              if (data.exists === true) {
                  console.log("Embeddings already exist");
                  chat.removeChild(loading);
                  document.querySelector("input[name='chat']").readOnly = false;
                  document.querySelector("input[name='chat']").value = "";
                  return;
                }
      
              try {
      
                const e = await embeddings(data.df);
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
                      body: JSON.stringify({key: sessionStorage.getItem("pdf-key"), df: e}),
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
                return false;   
              }
            } catch (error) {
              console.log(error);
              console.log("PDF could not be downloaded");
              loading.innerHTML = "Error: PDF could not be downloaded. Please try again later.";
              alert("Error: PDF could not be downloaded. Please try again later.");
              return false;
            }
          }

        if (type === "plain/text") {
            document.querySelector("input[name='chat']").readOnly = false;
            document.querySelector("input[name='chat']").value = "";

            const iframe = document.getElementById("pdf-viewer");
            iframe.style.display = "none";

            const c = document.getElementById("container");

            const text =  document.createElement("p");
            text.innerHTML = str;
            text.style.margin = "1rem";
            text.style.padding = "0";
            text.style.fontSize = "1.5rem";
            text.style.fontWeight = "bold";
            text.style.color = "white";
            text.style.textAlign = "center";

            // Add text inside container as the first child
            c.insertBefore(text, c.firstChild);
        }
    }

    async function getGPTModel() {
      try {
        const response = await fetch('https://api.openai.com/v1/models/gpt-4', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + sessionStorage.getItem("openai_key"),
            'Content-Type': 'application/json'
            }
          });
      if (response.status === 200) {
        return 'gpt-4';
        } else {
          return 'gpt-3.5-turbo';
        }
      } catch (error) {
        console.error('Error fetching GPT model:', error);
        return 'gpt-3.5-turbo';
      }
    }

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
    
      const sources = results.map((result) => {
        const pageNumber = result.page ? `Page ${result.page}` : `Paragraph ${result.paragraph}`;
        const textSnippet = result.text.slice(0, 150) + "...";
        return { [pageNumber]: textSnippet };
      });      
    
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
        document.getElementById('loading').innerHTML = 'Error: ' + data.error + '. Please make sure your api key is correct and try again. Close this tab and refresh the page to try again.';
        return;
      }
      df = JSON.parse(df);
      const x = await search(df, user_input);
      const result = x.results;
      const sources = x.sources;
      console.log(result);

      const systemRole = `You are a friendly assistant whose expertise is reading and summarizing scientific papers. 
      You are given a query and a series of text embeddings from a paper in order of their cosine similarity to the query.
      You must take the given embeddings and return a very detailed summary of the paper that answers the query. 
      Here are the top 3 embeddings: 

      1. ${result.at(0, 'text').text}

      2. ${result.at(1, 'text').text}

      3. ${result.at(2, 'text').text}

      Only use these embeddings if they are necessary to answer the query.`;

      const userContent = user_input;

      const messages = [
        { role: "system", content: systemRole },
        ];

      if (userContent) {
            messages.push({ role: "user", content: userContent });
        }

      console.log('Done creating prompt');
      return { messages, sources };
    }

    function addMessage(text, sender) {
        console.log(`Adding message: ${text}, sender: ${sender}`);
    
        if (sender === 'ai') {
            // Append the text to the last <p> element
            const lastMessage = chat.lastElementChild;
            if (lastMessage && lastMessage.className === 'ai') {
                // Check if the text is a punctuation mark
                const isPunctuation = /^[.,;?!]+$/.test(text);
                lastMessage.innerHTML += isPunctuation ? text : text;
            } else {
                // Create a new <p> element if the last message is not from 'ai'
                const message = document.createElement("p");
                message.className = sender;
                message.innerHTML = text;
                chat.style.color = "lightgray";
                chat.appendChild(message);
            }
        } else {
            // Create a new <p> element for other senders
            const message = document.createElement("p");
            message.className = sender;
            message.innerHTML = text;
            chat.appendChild(message);
        }
        chat.scrollTop = chat.scrollHeight;
    }

    async function gpt(messages) {

        console.log('Sending request to OpenAI');
      
        console.log('messages: ', messages);
        const m = await getGPTModel();
        const openaiApiKey = sessionStorage.getItem("openai_key");
        const response = await fetch('https://api.openai.com/v1/chat/completions?stream=true', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messages,
                model: 'gpt-4',
                max_tokens: 150,
                n: 1,
                temperature: 0.4,
                frequency_penalty: 0,
                presence_penalty: 0,
                stream: true
            })
        });
        let previousLastToken = '';

        const loading = document.getElementById('loading');
        chat.removeChild(loading);

        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('Stream finished');
                break;
            }
            const chunk = new TextDecoder().decode(value);
            // console.log(chunk);
    
            // Stop if the chunk is "data: [DONE]"
            if (chunk.trim() === "data: [DONE]") {
                console.log('Received "data: [DONE]", stopping.');
                break;
            }
    
            // Use a regular expression to match the JSON object
            const jsonRegex = /"content"\s*:\s*"([^"]*?)"/;
            const jsonMatch = chunk.match(jsonRegex);
    
            if (jsonMatch) {
                const data = jsonMatch[1];
    
                try {
                    // console.log(data);
    
                    // Extract the content value from the JSON data
                    const content = data;
    
                    // Concatenate the last token from the previous chunk with the first token of the current chunk
                    const combinedContent = previousLastToken;
    
                    // Store the last token of the current chunk for the next iteration
                    previousLastToken = content;
    
                    console.log(combinedContent);
    
                    // Replace \n in the combined content with <br> and \n\n with <br><br>
                    const combinedContentWithLineBreaks = combinedContent.replace(/\\n\\n/g, '<br><br>').replace(/\\n/g, '<br>');
    
                    // Call addMessage function with the combined content
                    addMessage(combinedContentWithLineBreaks, 'ai');
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                }
            }
        }
    }

    send.addEventListener("click", async function(event) {
          event.preventDefault();
          const message = document.querySelector("input[name='chat']").value;
          // if the message is empty, do nothing
          if (message === "") {
            return;
          }

          addMessage(message, 'user');
          
          const loading = document.createElement("p");
          loading.id = "loading";
          loading.style.color = "lightgray";
          loading.style.fontSize = "14px";
          loading.innerHTML = "Loading...";
          chat.appendChild(loading);

          const { messages, sources } = await create_prompt(message);
          await gpt(messages);
          console.log(sources);

          for (let i = 0; i < sources.length; i++) {
            const source = document.createElement("p");
            source.style.color = "lightgray";
            source.style.fontSize = "14px";
            console.log(sources[i]);
            source.innerHTML = JSON.stringify(sources[i], null, 2);
            chat.appendChild(source);
          }

          document.querySelector("input[name='chat']").value = "";
        });
});
