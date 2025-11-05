var composerDocTitle = "";
var composerMergeButtonTitle = "";
var composerFileIcon = "";
var composerCancelButton = "";
var composerDownloadIcon = "";
var composerUniqueIdForLC = "";

    function handleMessage(evt){
        var postObj = JSON.parse(evt.data);
        composerFileIcon = findFileIconForContentType(postObj.contentType);
        composerDocTitle = adjustDocTitleForFileIcon(postObj.filename, composerFileIcon);
        composerMergeButtonTitle = postObj.mergeButtonTitle;
        composerCancelButtonTitle = postObj.cancelButton;
        composerDownloadIcon = postObj.downloadIconTitle;
        composerUniqueIdForLC = postObj.uniqueIdForLC;

        var downloadUrl = postObj.downloadUrl;
        var downloadLink = document.getElementById('conga-preview-download-file-link');

        var mergeButton = document.getElementById('conga-preview-continue-merge-button');
        var cancelButton = document.getElementById('conga-preview-cancel-merge-button');

        if (! postObj.pdfBase64) {
            return;
        }
        
        mergeButton.firstElementChild.innerHTML = composerMergeButtonTitle;
        mergeButton.setAttribute("title", composerMergeButtonTitle);
        cancelButton.firstElementChild.innerHTML = composerCancelButtonTitle;
        cancelButton.setAttribute("title", composerCancelButtonTitle);

        downloadLink.setAttribute("title", composerDownloadIcon);
        downloadLink.setAttribute("href", downloadUrl);

        var pdfByteArray = base64PdfToByteArray(postObj.pdfBase64);
        PDFViewerApplication.open(pdfByteArray);
    }

    function base64PdfToByteArray (base64FromPdf) {
        var raw = atob(base64FromPdf);
        var uint8Array = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) {
            uint8Array[i] = raw.charCodeAt(i);
        }
        return uint8Array;
    }

    function findFileIconForContentType(contentType) {
        switch (contentType) {
            case "application/vnd.ms-excel":
            return "xlsIcon";
            case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            return "xlsxIcon";
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return "docxIcon";
            case "application/msword":
            return "docIcon";
            case "application/pdf":
            case "text/pdf":
            return "pdfIcon";
            case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
            return "pptxIcon";
            case "application/vnd.ms-powerpoint":
            return "pptIcon";
            default:
            return "";
        }
    }

    function adjustDocTitleForFileIcon(filename, fileIcon) {
        if (filename.indexOf(".") == -1) {
            return filename;
        }
        filename = filename.substring(0, filename.lastIndexOf("."));
        if (! fileIcon) {
            return filename;
        }
        return filename + "." + fileIcon.substring(0, fileIcon.indexOf('Icon'));
    }

    function postPreviewMessageToParent (msg) {
        clearViewer();
        var msgStr = JSON.stringify({"previewmerge":msg, "uniqueIdForLC":composerUniqueIdForLC});
        window.parent.postMessage(msgStr, window.parent.location.href);
    }

    function clearViewer () {
        composerDocTitle = "";
        composerMergeButtonTitle = "";
        composerFileIcon = "";
    }

    // call this from within viewer.js
    async function renderPreviewDocumentTitleAndIcon (parent, offsetY) {
        parent.scrollTop = offsetY - 50; // 50px for doc title

        var pageContainerDiv = document.getElementById("pageContainer1");
        if (! pageContainerDiv) {
            return;
        }
        var docWidth = pageContainerDiv.offsetWidth - 18; // 9px transparent border around doc viewer
        var docTitleDiv = document.getElementById("composer-doc-icon-and-title");
        docTitleDiv.style.width = docWidth + "px";
        document.getElementById("composer-doc-title").innerHTML = composerDocTitle;
        if (composerFileIcon) {
            document.getElementById("composer-doc-icon").setAttribute("src", "composerdocicons/" + composerFileIcon + ".png");
        } else {
            document.getElementById("composer-doc-icon").setAttribute("src", "");
        }
    }

    
