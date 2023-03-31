document.addEventListener("DOMContentLoaded", function () {

  const x = document.getElementById("url");
  x.value = ""

  const openPopupBtn = document.getElementById('open-popup-btn');
  const popupCard = document.getElementById('popup-card');
  const sidebar = document.getElementById('sidebar');

  document.getElementById("save-openai-key").addEventListener("click", function () {
    var openaiKey = document.getElementById("openai-key").value;
    if (openaiKey) {
      localStorage.setItem("openai_key", openaiKey);
      document.getElementById("openai-key").value = "Saved!"
      document.getElementById("openai-key").value = "";
    } else {
      alert("Please enter a valid OpenAI key.");
    }
  });  
  
  openPopupBtn.addEventListener('click', () => {
      popupCard.classList.toggle('hidden');
  });
  
  document.addEventListener('mousedown', (event) => {
      if (!popupCard.contains(event.target) && event.target !== openPopupBtn) {
          popupCard.classList.add('hidden');
      }
  });

  function toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    sidebar.classList.toggle("active");
  }
  
  function isInside(target, element) {
    return element.contains(target) || target === element;
  }
  
  document.addEventListener("click", function (event) {
    const sidebar = document.querySelector(".sidebar");
    const toggleIcon = document.querySelector(".toggle-icon");
    const isClickInsideSidebar = isInside(event.target, sidebar);
    const isClickInsideToggleIcon = isInside(event.target, toggleIcon);
  
    if (!isClickInsideSidebar && !isClickInsideToggleIcon && sidebar.classList.contains("active")) {
      toggleSidebar();
    }
  });

  var TxtRotate = createTxtRotateClass();
  initializeTxtRotate(TxtRotate);

  handleParagraphEllipsis();

  handleSubmitEvent();

  handleFileInputChange();

});

function createTxtRotateClass() {
  return function (el, toRotate, period) {
    this.toRotate = toRotate;
    this.el = el;
    this.loopNum = 0;
    this.period = parseInt(period, 10) || 1000;
    this.txt = '';
    this.tick();
    this.isDeleting = false;
  };
}

function initializeTxtRotate(TxtRotate) {
  TxtRotate.prototype.tick = function () {
    var i = this.loopNum % this.toRotate.length;
    var fullTxt = this.toRotate[i];
  
    if (this.isDeleting) {
      this.txt = fullTxt.substring(0, this.txt.length - 1);
    } else {
      this.txt = fullTxt.substring(0, this.txt.length + 1);
    }
  
    this.el.innerHTML = '<span class="wrap">'+this.txt+'</span>';
  
    var that = this;
    var delta = 300 - Math.random() * 100;
  
    if (this.isDeleting) { delta /= 2; }
  
    if (!this.isDeleting && this.txt === fullTxt) {
      delta = this.period;
      this.isDeleting = true;
    } else if (this.isDeleting && this.txt === '') {
      this.isDeleting = false;
      this.loopNum++;
      delta = 500;
    }
  
    setTimeout(function() {
      that.tick();
    }, delta);
  };

  var elements = document.getElementsByClassName('txt-rotate');
  for (var i = 0; i < elements.length; i++) {
    var toRotate = elements[i].getAttribute('data-rotate');
    var period = elements[i].getAttribute('data-period');
    if (toRotate) {
      new TxtRotate(elements[i], JSON.parse(toRotate), period);
    }
  }

  var css = document.createElement("style");
  css.type = "text/css";
  css.innerHTML = ".txt-rotate > .wrap { border-right: 0.08em solid #666 }";
  document.body.appendChild(css);
}

function handleParagraphEllipsis() {
  var para = document.querySelectorAll(".ellipsis");

  for (var i = 0; i < para.length; i++) {
    var paraTxt = para[i].innerHTML;

    if (paraTxt.length > 200) {
      var newPara = document.createElement("p"); //create new paragraph element
      newPara.className = "ellipsis-trunc";
      var newParaTxt = document.createTextNode(paraTxt.substring(0,200)+"...");
      //create new text node

      newPara.appendChild(newParaTxt); //bind new text node to new element
      para[i].replaceWith(newPara);
    } else {
      console.log("I've got nothing");
    }
  }
}

// A function getPageContent that given a url returns the text in the body of the page
async function getPageContent(url) {
  // set the request's mode to 'no-cors' 
  const response = await fetch(url, { mode: "no-cors" });
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.querySelector("body");
  return body.innerText;
}

async function handleSubmitEvent() {
  y = document.querySelector("#url");
  var x = document.querySelector("input[name='pdf-url']");
  y.addEventListener("submit", async function (event) {
    event.preventDefault();
    const url = this.elements["pdf-url"].value;
    if (url === "") {
        return;
    }

    if (url.includes("doc")) {
        window.location.href = `/viewer?url=${url}`;
        return;
    }

    if (!url.endsWith(".pdf") && !url.endsWith(".txt") && !url.includes("github")) {
        text = await getPageContent(url);
        console.log(text);

        // Save the text to the database
        const file_id = await saveFile(text, "text/plain");
        if (file_id) {
          window.location.href = `/viewer?url=${url}&file_id=${file_id}&type=text/plain`;
        }
    }

    // if the url has github in it then
    if (url.includes("github")) {
        // get the raw url
        var raw_url = url.replace("github", "raw.githubusercontent");
        raw_url = raw_url.replace("blob/", "");
        console.log(raw_url);
        window.location.href = `/viewer?url=${url}`;
        return;
    }

    x.value = "Loading...";
    console.log(url);

    let file_id = null;

    try {
      file = await fetch(url).then(r => {
        if (!r.ok) {
          throw new Error(`Network response was not ok: ${r.statusText}`);
        }
        return r.blob();
      });

      console.log("Duck");

      // Convert the Blob to an ArrayBuffer
      const buffer = await file.arrayBuffer();

      file_id = await saveFile(buffer, file.type);
      console.log(file_id);

    } catch (error) {
      console.log("Goose")
      console.error('There was a problem with the fetch operation:', error);
      alert('There was an error fetching the file. Please try again.');
      x.value = "Error!";
    } finally {
      console.log("DOG")
      if (file_id) {
        x.value = "Enter a URL...";
        window.location.href = `/viewer?file_id=${file_id}&type=${file.type}`;
        x.value = "";
      } else {
        x.value = "";
      }
    }
  });
}

window.onload = function() {
  // check if the user has already saved an API key
  if (localStorage.getItem("openai_key") === null) {
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
    localStorage.setItem("openai_key", input);
    alert("Thank you! Your key has been saved safely in your browser's local storage. You can now use the chatbot.");
  }
  else {
    console.log("API key already saved");
    return;
  }
};

async function getGPTModel() {
  try {
    const response = await fetch('https://api.openai.com/v1/models/gpt-4', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem("openai_key"),
        'Content-Type': 'application/json'
        }
      });
  if (response.status === 200) {
    console.log('GPT-4 model available');
    return 'gpt-4';
    } else {
      return 'gpt-3.5-turbo';
    }
  } catch (error) {
    console.error('Error fetching GPT model:', error);
    return 'gpt-3.5-turbo';
  }
}

async function saveFile(file, type) {

  const model = await getGPTModel();

  const response = await fetch("/save_file", {
    method: "POST",
    body: file,
    headers: {
      'Content-Type': type,
      // 'Content-Length': fileArrayBuffer.byteLength,
      'Model': model
    }
  });

  const data = await response.json();
  return data.key;
}

async function handleFileInputChange() {
  const pdfInput = document.getElementById("pdf-input");
  const docxInput = document.getElementById("docx-input");
  const txtInput = document.getElementById("txt-input");

  txtInput.addEventListener("change", async function () {
    const file = this.files[0];
    // Log the file name, size, and type
    const fileArrayBuffer = await file.arrayBuffer();

    console.log(file.name, file.size, file.type);
    const file_id = await saveFile(fileArrayBuffer, file.type);
    console.log(file_id);
    type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    window.location.href = `/viewer?file_id=${file_id}&type=${type}`;
  });
  
  pdfInput.addEventListener("change", async function () {
    const file = this.files[0];
    const fileArrayBuffer = await file.arrayBuffer();
    console.log(file);
    // Log the file name, size, and type
    console.log(file.name, file.size, file.type);
    const file_id = await saveFile(fileArrayBuffer, file.type);
    console.log(file_id);
    type = file.type;
    window.location.href = `/viewer?file_id=${file_id}&type=${type}`;
  });
  
  docxInput.addEventListener("change", async function () {
    const file = this.files[0];
    // Log the file name, size, and type
    console.log(file.name, file.size, file.type);
    const file_id = await saveFile(file, file.type);
    type = file.type;

    console.log(file_id);
    if (file_id) {
      window.location.href = `/viewer?file_id=${file_id}&type=${type}`;
    }
  });
}
