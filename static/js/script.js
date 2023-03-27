document.addEventListener("DOMContentLoaded", function () {

  const openPopupBtn = document.getElementById('open-popup-btn');
  const popupCard = document.getElementById('popup-card');
  const sidebar = document.getElementById('sidebar');
  
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

function handleSubmitEvent() {
  y = document.querySelector("#url");
  y.addEventListener("submit", function (event) {
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
        uploadBtn.innerHTML = "Error: Request to server failed. Please try again. Check the URL if there is https:// at the beginning. If not, add it.";
        x.innerHTML = "Error: Request to server failed. Please try again. Check the URL if there is https:// at the beginning. If not, add it.";
        console.error(error);
      });
  });
}

function handleFileInputChange() {
  const viewer = document.querySelector("#pdf-viewer");
  const input = document.querySelector("#file-input");
  input.addEventListener("change", async function () {
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
    // Append the reply to #chat as a simple paragraph without any styling
    .then(data => {
      chat.removeChild(loading);
      window.key = data.key;
    })
    .catch(error => {
      loading.innerHTML = "Error: Processing the pdf failed due to excess load. Please try again later.  Check the URL if there is https:// at the beginning. If not, add it.";
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
}
