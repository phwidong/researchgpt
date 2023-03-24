// grid.js

document.addEventListener("DOMContentLoaded", function () {
    fillGrid();
    // handleSubmitEvent();
    // handleFileInputChange();
  });
  
  async function fillGrid() {
  
      document.getElementById('pdf-grid-container').style.display = 'flex';
      document.getElementById('pdf-grid-container').style.flexWrap = 'wrap';
      console.log('clicked');
  
      const response = await fetch('/get_pdfs');
      const data = await response.json();
  
      const pdfGrid = document.getElementById('pdf-grid');
      pdfGrid.style.marginLeft = '50px';
      pdfGrid.style.marginRight = '50px';
  
      data.forEach(item => {
        const pdfItem = document.createElement('div');
        pdfItem.style.width = '150px';
        pdfItem.style.margin = '20px';
        pdfItem.style.textAlign = 'center';
  
        const pdfIcon = document.createElement('img');
        pdfIcon.src = 'data:image/png;base64,' + item.preview_image;
        pdfIcon.style.width = '150px';
        pdfIcon.style.height = '200px';
        pdfIcon.style.objectFit = 'contain';
  
        // Inside the loop where you create the pdfItem
        pdfIcon.addEventListener('click', async function () {
          window.location.href = `/viewer?pdfPath=${encodeURIComponent(item.path)}`;
        });
  
        const pdfTitle = document.createElement('p');
        pdfTitle.textContent = item.title;
        // cut off the title if it is too long
        if (pdfTitle.textContent.length > 20) {
          pdfTitle.textContent = pdfTitle.textContent.substring(0, 20) + '...';
        }
        pdfTitle.style.marginTop = '10px';
        // change the color of the title to white
        pdfTitle.style.color = 'white';
  
        pdfItem.appendChild(pdfIcon);
        pdfItem.appendChild(pdfTitle);
  
        pdfGrid.appendChild(pdfItem);
      });
  
    }
  
//   function handleSubmitEvent() {
//     y.addEventListener("submit", function (event) {
//       event.preventDefault();
//       const url = this.elements["pdf-url"].value;
//       if (url === "") {
//           return;
//       }
//       // if the url does not end with .pdf, make x.value = "Error: URL does not end with .pdf"
//       if (!url.endsWith(".pdf")) {
//           x.value = "Error: URL does not end with .pdf";
//           return;
//       }
//       x.value = "Loading...";
//       console.log(url);
//       fetch(url)
//       .then(response => response.blob())
//       .then(pdfBlob => {
//           console.log(pdfBlob);
//           const pdfUrl = URL.createObjectURL(pdfBlob);
//           pdfjsLib.getDocument(pdfUrl).promise.then(pdfDoc => {
//               viewer.src = pdfUrl;
//               uploadBtn.style.display = "none";
//               form.style.display = "none";
//               form.style.marginTop = "0px";
//               p.style.display = "none";
//               up.style.display = "none";
//               container.style.display = "flex";
//               viewer.style.display = "block";
//           });
//           })
//           .catch(error => {
//               console.error(error);
//           });
//       var loading = document.createElement("p");
//       loading.style.color = "lightgray";
//       loading.style.fontSize = "14px";
//       loading.innerHTML = "Calculating embeddings...";
//       chat.appendChild(loading);
  
//       // Make a POST request to the server 'myserver/download-pdf' with the URL
//       fetch('/download_pdf', {
//         method: 'POST',
//         body: JSON.stringify({'url': url}),
//         headers: {
//             'Content-Type': 'application/json',
//             'Access-Control-Allow-Origin': '*',
//             'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
//             'Access-Control-Allow-Headers': 'Content-Type, Authorization'
//         }
//         })
//         .then(response => response.json())
//         // Append the reply to #chat as a simple paragraph without any styling
//         .then(data => {
//           chat.removeChild(loading);
//           window.key = data.key;
//         })
//         .catch(error => {
//           uploadBtn.innerHTML = "Error: Request to server failed. Please try again. Check the URL if there is https:// at the beginning. If not, add it.";
//           x.innerHTML = "Error: Request to server failed. Please try again. Check the URL if there is https:// at the beginning. If not, add it.";
//           console.error(error);
//         });
//     });
//   }
  
//   function handleFileInputChange() {
//     input.addEventListener("change", async function () {
//       const file = this.files[0];
//       const fileArrayBuffer = await file.arrayBuffer();
//       console.log(fileArrayBuffer);
    
//       var loading = document.createElement("p");
//       loading.style.color = "lightgray";
//       loading.style.fontSize = "14px";
//       loading.innerHTML = "Calculating embeddings...";
//       chat.appendChild(loading);
    
//       // Make a post request to /process_pdf with the file
//       fetch('/process_pdf', {
//           method: 'POST',
//           body: fileArrayBuffer,
//           headers: {
//               'Content-Type': 'application/pdf',
//               'Content-Length': fileArrayBuffer.byteLength,
//               'Access-Control-Allow-Origin': '*',
//               'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
//               'Access-Control-Allow-Headers': 'Content-Type, Authorization'
//           }
//       })
//       .then(response => response.json())
//       // Append the reply to #chat as a simple paragraph without any styling
//       .then(data => {
//         chat.removeChild(loading);
//         window.key = data.key;
//       })
//       .catch(error => {
//         loading.innerHTML = "Error: Processing the pdf failed due to excess load. Please try again later.  Check the URL if there is https:// at the beginning. If not, add it.";
//         console.error(error);
//       });
        
//       pdfjsLib.getDocument(fileArrayBuffer).promise.then(pdfDoc => {
//       viewer.src = URL.createObjectURL(file);
//       uploadBtn.style.display = "none";
//       form.style.display = "none";
//       form.style.marginTop = "0px";
//       p.style.display = "none";
//       up.style.display = "none";
//       container.style.display = "flex";
//       viewer.style.display = "block";
//       }).catch(error => {
//       console.error(error);
//       });
//     });
//   }
  